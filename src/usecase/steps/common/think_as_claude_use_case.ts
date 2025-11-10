import { ThinkResponse, ThinkStep, ProposedChange, FileAnalysis } from '../../../data/model/think_response';
import { Execution } from '../../../data/model/execution';
import { Result } from '../../../data/model/result';
import { FileRepository } from '../../../data/repository/file_repository';
import { IssueRepository } from '../../../data/repository/issue_repository';
import { logDebugInfo, logError, logInfo } from '../../../utils/logger';
import { ParamUseCase } from '../../base/param_usecase';
import { ThinkCodeManager } from './think_code_manager';
import { ThinkTodoManager } from './think_todo_manager';
import { FileSearchService } from './services/file_search_service';
import { CommentFormatter } from './services/comment_formatter';
import { ThinkUseCase } from './think_use_case';

// Agent SDK imports
import { query, createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import type { SDKMessage, SDKResultMessage } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

/**
 * ThinkUseCase implementation for Anthropic Claude models using the Agent SDK
 * 
 * This use case leverages the Anthropic Agent SDK for automatic reasoning,
 * context management, and tool ecosystem, while maintaining domain-specific
 * logic like virtual codebase, TODOs, and GitHub integration.
 * 
 * NOTE: Currently uses ThinkUseCase as fallback until Agent SDK is fully integrated.
 */
export class ThinkAsClaudeUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'ThinkAsClaudeUseCase';
    // Removed aiRepository - we use Agent SDK directly, not OpenRouter
    private fileRepository: FileRepository = new FileRepository();
    private issueRepository: IssueRepository = new IssueRepository();
    
    // Services - Only keep what's essential for Agent SDK
    // Agent SDK handles file operations, code analysis, and context management natively
    // We only need domain-specific services:
    private fileSearchService: FileSearchService = new FileSearchService(); // Simple in-memory index (very cheap)
    private commentFormatter: CommentFormatter = new CommentFormatter(); // Required for GitHub output formatting
    
    // Removed services that Agent SDK handles natively:
    // - CodebaseAnalyzer: Agent SDK does code analysis during execution (more efficient)
    // - FileImportAnalyzer: Agent SDK can analyze imports when needed
    // - FileCacheManager: Agent SDK manages its own context/cache
    
    async invoke(param: Execution): Promise<Result[]> {
        logInfo(`Executing ${this.taskId} (using Anthropic Agent SDK).`);

        const results: Result[] = [];

        try {
            // Extract the question/prompt from the issue, PR, or comment
            let question = '';
            let description = '';

            if (param.issue.isIssueComment) {
                question = param.issue.commentBody || '';
                description = await this.getIssueDescription(param) || '';
            } else if (param.pullRequest.isPullRequestReviewComment) {
                question = param.pullRequest.commentBody || '';
                description = await this.getIssueDescription(param) || '';
            } else if (param.issue.isIssue) {
                description = await this.getIssueDescription(param) || '';
                question = description;
            } else if (param.singleAction.isThinkAction) {
                const commentBody = param.issue.commentBody || param.inputs?.comment?.body || '';
                if (commentBody) {
                    question = commentBody;
                    description = await this.getIssueDescription(param) || '';
                } else {
                    description = await this.getIssueDescription(param) || '';
                    question = description || '';
                }
            }

            if (!question || question.length === 0) {
                if (!param.singleAction.isThinkAction) {
                    results.push(
                        new Result({
                            id: this.taskId,
                            success: false,
                            executed: false,
                            errors: ['No question or prompt provided.'],
                        })
                    );
                    return results;
                }
            }

            if (param.ai.getOpenRouterModel().length === 0 || param.ai.getOpenRouterApiKey().length === 0) {
                results.push(
                    new Result({
                        id: this.taskId,
                        success: false,
                        executed: false,
                        errors: ['OpenRouter model or API key not found.'],
                    })
                );
                return results;
            }

            logInfo(`🔎 Question: ${question}`);
            logInfo(`🔎 Description: ${description}`);

            if (question.length === 0 || !question.includes(`@${param.tokenUser}`)) {
                logInfo(`🔎 Comment body is empty or does not include @${param.tokenUser}`);
                results.push(
                    new Result({
                        id: this.taskId,
                        success: true,
                        executed: false,
                    })
                );
                return results;
            } else {
                question = question.replace(`@${param.tokenUser}`, '').trim();
            }

            // Get full repository content
            logInfo(`📚 Loading repository content for ${param.owner}/${param.repo}/${param.commit.branch}`);
            const repositoryFiles = await this.fileRepository.getRepositoryContent(
                param.owner,
                param.repo,
                param.tokens.token,
                param.commit.branch,
                param.ai.getAiIgnoreFiles(),
                (fileName: string) => logDebugInfo(`Loading: ${fileName}`),
                (fileName: string) => logDebugInfo(`Ignoring: ${fileName}`)
            );

            logInfo(`📚 Loaded ${repositoryFiles.size} files from repository`);

            // Initialize code manager with repository files
            const codeManager = new ThinkCodeManager();
            codeManager.initialize(repositoryFiles);

            // Initialize TODO manager
            const todoManager = new ThinkTodoManager();

            // Build simple file index for quick lookup (very cheap, in-memory only)
            const fileIndex = this.fileSearchService.buildFileIndex(repositoryFiles);
            
            // Skip expensive pre-analysis - Agent SDK will analyze codebase during execution
            // This is more efficient as it only analyzes what's actually needed
            logInfo(`🤖 Using Agent SDK for reasoning (codebase analysis will be done on-demand)...`);
            
            // Build simple file list context (no AI calls, just metadata)
            const fileListContext = this.buildSimpleFileListContext(repositoryFiles);
            
            // Use Agent SDK for reasoning
            const agentResult = await this.executeWithAgentSDK(
                param,
                question,
                description,
                fileListContext, // Simple file list instead of expensive AI analysis
                codeManager,
                todoManager,
                fileIndex,
                repositoryFiles
            );

            // Check if Agent SDK is implemented (has actual results)
            const isAgentSDKImplemented = agentResult.steps.length > 0 || 
                                         agentResult.analyzedFiles.size > 0 ||
                                         agentResult.proposedChanges.length > 0;

            if (!isAgentSDKImplemented) {
                // Fallback to standard ThinkUseCase logic
                logInfo(`⚠️ Agent SDK not yet implemented. Falling back to standard ThinkUseCase logic.`);
                // Temporarily override model detection to prevent infinite loop
                const originalModel = param.ai.getOpenRouterModel();
                // Create a modified param that won't trigger Claude detection
                const fallbackParam = { ...param };
                // Use standard ThinkUseCase but bypass Claude detection
                const standardThinkUseCase = new ThinkUseCase();
                // We need to call the internal logic directly, but since it's private,
                // we'll use a workaround: temporarily change the model name
                // Actually, better approach: just use the standard logic by calling
                // the standard ThinkUseCase's invoke but with a non-Claude model temporarily
                logInfo(`🔄 Using standard reasoning logic as fallback...`);
                // For now, delegate to a helper that uses standard logic
                return await this.useStandardLogicAsFallback(param, question, description);
            }

            // Process agent SDK results
            const steps: ThinkStep[] = agentResult.steps || [];
            const analyzedFiles: Map<string, FileAnalysis> = agentResult.analyzedFiles || new Map();
            const allProposedChanges: ProposedChange[] = agentResult.proposedChanges || [];
            const finalAnalysis = agentResult.finalAnalysis || '';

            // Use the final analysis from Agent SDK
            // The Agent SDK should provide a comprehensive analysis as part of its execution
            // If it doesn't, we use the summary we built from the tracked steps
            let finalAnalysisText = finalAnalysis;
            if (!finalAnalysisText || finalAnalysisText.trim().length === 0) {
                // Build a summary from the steps if Agent SDK didn't provide one
                finalAnalysisText = this.buildSummaryFromSteps(
                    question,
                    analyzedFiles,
                    allProposedChanges,
                    steps,
                    todoManager
                );
            }

            // Format and post comprehensive reasoning comment
            const formattedComment = this.commentFormatter.formatReasoningComment(
                question,
                description,
                steps,
                analyzedFiles,
                allProposedChanges,
                finalAnalysisText,
                steps.length,
                todoManager
            );

            // Determine issue number
            let issueNumber = param.issueNumber;
            if (param.singleAction.isThinkAction && issueNumber <= 0) {
                issueNumber = param.issue?.number || 1;
            }

            // Post comment if we have a valid issue number and token
            if (issueNumber > 0 && param.tokens.token) {
                try {
                    await this.issueRepository.addComment(
                        param.owner,
                        param.repo,
                        issueNumber,
                        formattedComment,
                        param.tokens.token
                    );
                    logInfo(`✅ Posted reasoning comment to issue #${issueNumber}`);
                } catch (error) {
                    logError(`Failed to post comment to issue: ${error}`);
                }
            } else {
                logInfo(`⏭️ Skipping comment post: issueNumber=${issueNumber}, hasToken=${!!param.tokens.token}`);
            }

            results.push(
                new Result({
                    id: this.taskId,
                    success: true,
                    executed: true,
                    steps: steps.map(s => `Step ${s.step_number}: ${s.action} - ${s.reasoning.substring(0, 200)}`),
                    payload: {
                        steps: steps,
                        analyzed_files: Array.from(analyzedFiles.values()),
                        proposed_changes: allProposedChanges,
                        final_analysis: finalAnalysisText,
                        total_iterations: steps.length,
                        total_files_analyzed: analyzedFiles.size,
                        comment_posted: issueNumber > 0
                    }
                })
            );

        } catch (error) {
            logError(`Error in ${this.taskId}: ${JSON.stringify(error, null, 2)}`);
            results.push(
                new Result({
                    id: this.taskId,
                    success: false,
                    executed: true,
                    steps: [`Error in ${this.taskId}: ${JSON.stringify(error, null, 2)}`],
                })
            );
        }

        return results;
    }

    /**
     * Build simple file list context (no AI calls, just metadata)
     * This is much cheaper than doing expensive pre-analysis
     */
    private buildSimpleFileListContext(repositoryFiles: Map<string, string>): string {
        const files = Array.from(repositoryFiles.keys());
        const codeFiles = files.filter(f => {
            const ext = f.split('.').pop()?.toLowerCase() || '';
            return ['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.kt', '.go', '.rs', '.rb', '.php', '.swift', '.dart'].includes(`.${ext}`);
        });
        
        return `Repository contains ${files.length} total files (${codeFiles.length} code files).

Main code directories:
${this.groupFilesByDirectory(codeFiles).slice(0, 20).map(([dir, files]) => 
    `- ${dir}: ${files.length} files`
).join('\n')}

Use search_files to find specific files, then read_file to examine them.`;
    }

    /**
     * Group files by directory for simple context
     */
    private groupFilesByDirectory(files: string[]): Array<[string, string[]]> {
        const dirMap = new Map<string, string[]>();
        
        for (const file of files) {
            const parts = file.split('/');
            if (parts.length > 1) {
                const dir = parts.slice(0, -1).join('/');
                if (!dirMap.has(dir)) {
                    dirMap.set(dir, []);
                }
                dirMap.get(dir)!.push(file);
            }
        }
        
        return Array.from(dirMap.entries()).sort((a, b) => b[1].length - a[1].length);
    }

    /**
     * Execute reasoning using Anthropic Agent SDK
     * 
     * This method integrates with the Agent SDK to handle automatic reasoning,
     * while maintaining our domain-specific logic (virtual codebase, TODOs, etc.)
     */
    private async executeWithAgentSDK(
        param: Execution,
        question: string,
        description: string,
        codebaseAnalysisText: string,
        codeManager: ThinkCodeManager,
        todoManager: ThinkTodoManager,
        fileIndex: Map<string, string[]>,
        repositoryFiles: Map<string, string>
    ): Promise<{
        steps: ThinkStep[];
        analyzedFiles: Map<string, FileAnalysis>;
        proposedChanges: ProposedChange[];
        finalAnalysis: string;
    }> {
        try {
            // Agent SDK is imported statically at the top of the file

            // Get API key - try environment variable first, then fallback to OpenRouter key
            // NOTE: Agent SDK typically requires Anthropic API key directly, not OpenRouter
            const apiKey = process.env.ANTHROPIC_API_KEY || param.ai.getOpenRouterApiKey();
            
            if (!apiKey) {
                logError('No API key available for Agent SDK');
                return {
                    steps: [],
                    analyzedFiles: new Map(),
                    proposedChanges: [],
                    finalAnalysis: 'API key not configured. Please set ANTHROPIC_API_KEY environment variable.'
                };
            }

            // Get model name - extract Claude model from OpenRouter format if needed
            let modelName = param.ai.getOpenRouterModel();
            // If using OpenRouter format like "anthropic/claude-3.5-sonnet", extract just the model part
            if (modelName.includes('/')) {
                modelName = modelName.split('/').pop() || modelName;
            }

            logInfo(`🤖 Initializing Agent SDK with model: ${modelName}`);

            // Track state for conversion
            const trackedSteps: ThinkStep[] = [];
            const trackedAnalyzedFiles: Map<string, FileAnalysis> = new Map();
            const trackedProposedChanges: ProposedChange[] = [];
            let stepCounter = 0;

            // Create custom tools that integrate with our domain logic
            // These tools extend the Agent SDK's native capabilities
            // The SDK may have built-in file operations, but we need our virtual codebase
            // and TODO system which are domain-specific
            const customTools = [
                {
                    name: 'read_file',
                    description: 'Read a file from the repository. Returns the file content with any modifications applied.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            file_path: {
                                type: 'string',
                                description: 'The path to the file to read'
                            }
                        },
                        required: ['file_path']
                    },
                    execute: async (args: { file_path: string }) => {
                        stepCounter++;
                        const content = codeManager.getFileContent(args.file_path);
                        const isModified = codeManager.isFileModified(args.file_path);
                        
                        logInfo(`📖 [Tool] Reading file: ${args.file_path} (modified: ${isModified})`);
                        
                        // Track as step
                        trackedSteps.push({
                            step_number: stepCounter,
                            action: 'read_file',
                            reasoning: `Reading file: ${args.file_path}`,
                            files_involved: [args.file_path],
                            timestamp: Date.now()
                        });

                        if (!content) {
                            return { 
                                content: null, 
                                error: 'File not found',
                                available_files: Array.from(repositoryFiles.keys()).slice(0, 20)
                            };
                        }

                        return { 
                            content: content,
                            is_modified: isModified,
                            file_path: args.file_path
                        };
                    }
                },
                {
                    name: 'search_files',
                    description: 'Search for files in the repository by name, path, or pattern. Returns a list of matching file paths.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            query: {
                                type: 'string',
                                description: 'Search query (file name, path pattern, or keywords)'
                            }
                        },
                        required: ['query']
                    },
                    execute: async (args: { query: string }) => {
                        stepCounter++;
                        const foundFiles = this.fileSearchService.searchFiles([args.query], fileIndex);
                        
                        logInfo(`🔍 [Tool] Searching files with query: "${args.query}" - Found ${foundFiles.length} files`);
                        
                        // Track as step
                        trackedSteps.push({
                            step_number: stepCounter,
                            action: 'search_files',
                            reasoning: `Searching for files matching: ${args.query}`,
                            files_involved: foundFiles,
                            timestamp: Date.now()
                        });

                        return { 
                            files: foundFiles,
                            count: foundFiles.length,
                            query: args.query
                        };
                    }
                },
                {
                    name: 'propose_change',
                    description: 'Propose a change to a file in the virtual codebase. Changes are applied incrementally and can be built upon in subsequent steps.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            file_path: {
                                type: 'string',
                                description: 'Path to the file to modify'
                            },
                            change_type: {
                                type: 'string',
                                enum: ['create', 'modify', 'delete', 'refactor'],
                                description: 'Type of change to make'
                            },
                            description: {
                                type: 'string',
                                description: 'Human-readable description of the change'
                            },
                            reasoning: {
                                type: 'string',
                                description: 'Explanation of why this change is needed'
                            },
                            suggested_code: {
                                type: 'string',
                                description: 'The code to add or modify (for create/modify/refactor)'
                            }
                        },
                        required: ['file_path', 'change_type', 'description', 'reasoning']
                    },
                    execute: async (args: ProposedChange) => {
                        stepCounter++;
                        
                        // Check if change already applied
                        if (codeManager.hasChangeBeenApplied(args)) {
                            logInfo(`⚠️ [Tool] Change already applied: ${args.file_path} - ${args.description}`);
                            return { 
                                success: false, 
                                message: 'This change has already been applied',
                                file_path: args.file_path
                            };
                        }

                        const success = codeManager.applyChange(args);
                        
                        logInfo(`✏️ [Tool] Proposed change: ${args.change_type} to ${args.file_path} - ${args.description}`);
                        
                        if (success) {
                            trackedProposedChanges.push(args);
                            
                            // Auto-update TODOs based on changes
                            todoManager.autoUpdateFromChanges([args]);
                        }

                        // Track as step
                        trackedSteps.push({
                            step_number: stepCounter,
                            action: 'propose_changes',
                            reasoning: args.reasoning || args.description,
                            files_involved: [args.file_path],
                            timestamp: Date.now()
                        });

                        return { 
                            success: success,
                            file_path: args.file_path,
                            change_type: args.change_type,
                            message: success ? 'Change applied to virtual codebase' : 'Failed to apply change'
                        };
                    }
                },
                {
                    name: 'manage_todos',
                    description: 'Create or update TODO items to track high-level tasks. Use this to break down complex problems into manageable tasks.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            action: {
                                type: 'string',
                                enum: ['create', 'update'],
                                description: 'Action to perform: create a new TODO or update an existing one'
                            },
                            todo_id: {
                                type: 'string',
                                description: 'ID of TODO to update (required for update action). Use exact ID from TODO list.'
                            },
                            content: {
                                type: 'string',
                                description: 'Content/description of the TODO (required for create action)'
                            },
                            status: {
                                type: 'string',
                                enum: ['pending', 'in_progress', 'completed', 'cancelled'],
                                description: 'Status of the TODO'
                            },
                            notes: {
                                type: 'string',
                                description: 'Additional notes about the TODO'
                            }
                        },
                        required: ['action']
                    },
                    execute: async (args: {
                        action: 'create' | 'update';
                        todo_id?: string;
                        content?: string;
                        status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
                        notes?: string;
                    }) => {
                        stepCounter++;
                        
                        if (args.action === 'create') {
                            if (!args.content) {
                                return { success: false, error: 'content is required for create action' };
                            }
                            const todo = todoManager.createTodo(
                                args.content,
                                (args.status as 'pending' | 'in_progress') || 'pending'
                            );
                            logInfo(`📋 [Tool] Created TODO: ${todo.id} - ${args.content}`);
                            
                            trackedSteps.push({
                                step_number: stepCounter,
                                action: 'update_todos',
                                reasoning: `Created TODO: ${args.content}`,
                                timestamp: Date.now()
                            });
                            
                            return { 
                                success: true, 
                                todo: todo,
                                action: 'created'
                            };
                        } else if (args.action === 'update') {
                            if (!args.todo_id) {
                                return { success: false, error: 'todo_id is required for update action' };
                            }
                            const success = todoManager.updateTodo(args.todo_id, {
                                status: args.status,
                                notes: args.notes
                            });
                            
                            if (success) {
                                logInfo(`📋 [Tool] Updated TODO: ${args.todo_id} - status: ${args.status}`);
                            } else {
                                logInfo(`⚠️ [Tool] Failed to update TODO: ${args.todo_id} (not found)`);
                            }
                            
                            trackedSteps.push({
                                step_number: stepCounter,
                                action: 'update_todos',
                                reasoning: `Updated TODO ${args.todo_id}: ${args.status || 'status updated'}`,
                                timestamp: Date.now()
                            });
                            
                            return { 
                                success: success,
                                todo_id: args.todo_id,
                                action: 'updated',
                                message: success ? 'TODO updated successfully' : 'TODO not found'
                            };
                        }
                        
                        return { success: false, error: 'Invalid action' };
                    }
                },
                {
                    name: 'analyze_code',
                    description: 'Analyze code from files you have read. Use this to document findings and understand relationships between files.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            file_path: {
                                type: 'string',
                                description: 'Path to the file being analyzed'
                            },
                            key_findings: {
                                type: 'string',
                                description: 'Key findings or insights about this file'
                            },
                            relevance: {
                                type: 'string',
                                enum: ['high', 'medium', 'low'],
                                description: 'Relevance level of this file to the task'
                            }
                        },
                        required: ['file_path', 'key_findings', 'relevance']
                    },
                    execute: async (args: FileAnalysis) => {
                        stepCounter++;
                        
                        if (!trackedAnalyzedFiles.has(args.path)) {
                            trackedAnalyzedFiles.set(args.path, args);
                            logInfo(`🔬 [Tool] Analyzed file: ${args.path} (${args.relevance} relevance)`);
                        }
                        
                        trackedSteps.push({
                            step_number: stepCounter,
                            action: 'analyze_code',
                            reasoning: `Analysis of ${args.path}: ${args.key_findings.substring(0, 100)}...`,
                            files_involved: [args.path],
                            timestamp: Date.now()
                        });
                        
                        return { 
                            success: true,
                            file_path: args.path,
                            relevance: args.relevance
                        };
                    }
                }
            ];

            // Build optimized system prompt
            // The Agent SDK handles context compression automatically, so we can be comprehensive
            // Key principles:
            // 1. Be specific about capabilities and constraints
            // 2. Guide the agent on when to use which tools
            // 3. Emphasize incremental, systematic approach
            const systemPrompt = `You are an advanced code analysis assistant powered by Claude Agent SDK. Your role is to perform deep, systematic analysis of codebases and propose thoughtful, incremental changes.

**AGENT SDK CAPABILITIES**:
- Automatic context management: The SDK handles context compression, so you can work with large codebases
- Efficient reasoning: The SDK optimizes your reasoning process automatically
- Error recovery: Built-in error handling ensures robust execution
- Tool orchestration: You can use multiple tools in sequence to accomplish complex tasks

**CRITICAL CONCEPTS**:

1. **VIRTUAL CODEBASE**: You are working with a VIRTUAL CODEBASE. When you propose changes, they are automatically applied to the code in memory. Subsequent steps will see the MODIFIED code, not the original. This allows you to build upon previous changes incrementally.

2. **TODO LIST SYSTEM**: You have a TODO list system to track high-level tasks. Each task in the TODO list may require multiple reasoning steps (search, read, analyze, propose). Use this to:
   - Create TODOs in your first steps to break down the problem
   - Update TODO status as you make progress (pending → in_progress → completed)
   - Link your actions to TODOs to show which task you're working on

3. **TWO-LEVEL REASONING**: 
   - **High-level (TODO list)**: What major tasks need to be done?
   - **Low-level (reasoning steps)**: How do I accomplish each task? (search, read, analyze, propose)

${codebaseAnalysisText ? `\n\n## 📋 Repository File List\n\n${codebaseAnalysisText}\n\n**This is a simple file list to help you navigate the repository. Use search_files to find relevant files, then read_file to examine them.**\n\n` : ''}

## Current Task

${description ? `### Context/Issue Description:\n\`\`\`\n${description}\n\`\`\`` : ''}

### User's Question/Prompt:
\`\`\`
${question}
\`\`\`

## Available Tools

You have access to the following custom tools that integrate with the codebase:

1. **search_files**: Search for files by name, path, or pattern. Use this FIRST to discover relevant files.
   - Returns: List of matching file paths
   - When to use: When you need to find files related to a feature, module, or concept

2. **read_file**: Read a file from the repository. Shows CURRENT STATE including all modifications applied so far.
   - Returns: File content with modification markers
   - When to use: After finding relevant files, read them to understand the code
   - Important: Files show modified state, so you can see incremental progress

3. **analyze_code**: Document your findings about files you've read. Helps build understanding.
   - Returns: Confirmation of analysis recorded
   - When to use: After reading files, document key findings, relationships, and insights

4. **propose_change**: Propose changes to files. Changes are applied to virtual codebase immediately.
   - Types: create, modify, delete, refactor
   - Returns: Confirmation of change application
   - When to use: When you understand what needs to change and have a clear plan
   - Important: Changes are incremental - build upon previous changes

5. **manage_todos**: Create and update TODO items to track high-level tasks.
   - Actions: create, update
   - When to use: 
     - CREATE: At the start to break down the problem
     - UPDATE: As you make progress on tasks
   - Important: Use exact TODO IDs when updating

## Systematic Workflow

Follow this systematic approach for best results:

**Phase 1: Discovery & Planning**
1. Create initial TODOs to break down the problem
2. Use search_files to discover relevant files
3. Read key files to understand the codebase structure

**Phase 2: Analysis**
4. Analyze code to document findings and relationships
5. Read additional files as needed based on findings
6. Build comprehensive understanding

**Phase 3: Implementation**
7. Propose changes incrementally, starting with foundational changes
8. Read modified files to see current state
9. Build upon previous changes
10. Update TODOs as tasks are completed

**Phase 4: Completion**
11. Verify all changes work together
12. Complete remaining TODOs
13. Provide final comprehensive analysis

## Best Practices

- **Be systematic**: Don't skip steps, build understanding incrementally
- **Use TODOs effectively**: Break down complex tasks, track progress
- **Read before modifying**: Always understand code before proposing changes
- **Build incrementally**: Each change should build upon previous ones
- **Verify state**: Read files after changes to see current state
- **Document findings**: Use analyze_code to record insights
- **Think holistically**: Consider how changes affect the entire system

## Quality Standards

- **Thoroughness**: Analyze all relevant parts of the codebase
- **Accuracy**: Propose changes that are correct and well-reasoned
- **Completeness**: Address all aspects of the task
- **Clarity**: Provide clear reasoning for all changes
- **Maintainability**: Propose changes that improve code quality

Work systematically, be thorough, and build understanding incrementally.`;

            // Build user prompt with clear structure
            const userPrompt = `${description ? `## Context\n${description}\n\n` : ''}## Task\n${question}\n\n${codebaseAnalysisText ? `\n## Repository Information\n${codebaseAnalysisText}\n` : ''}\n\nPlease analyze this codebase systematically and help with the task above.`;

            logInfo(`🚀 Starting Agent SDK execution with ${customTools.length} custom tools...`);
            logInfo(`📊 Repository: ${repositoryFiles.size} files available`);

            // Use the query function from Agent SDK
            // The SDK provides automatic:
            // - Context compression when needed
            // - Error recovery
            // - Step-by-step reasoning tracking
            // - Session management
            // - Optimized performance with prompt caching
            
            // Create MCP server for our custom tools
            // The SDK uses MCP (Model Context Protocol) for tool integration
            // Convert our custom tools to MCP format with Zod schemas
            const mcpTools = customTools.map(t => {
                // Convert JSON Schema to Zod schema based on tool name
                let zodSchema: z.ZodRawShape;
                
                if (t.name === 'read_file') {
                    zodSchema = {
                        file_path: z.string().describe('Path to the file to read')
                    };
                } else if (t.name === 'search_files') {
                    zodSchema = {
                        query: z.string().describe('Search query (file name, path pattern, or keywords)')
                    };
                } else if (t.name === 'propose_change') {
                    zodSchema = {
                        file_path: z.string().describe('Path to the file to modify'),
                        change_type: z.enum(['create', 'modify', 'delete', 'refactor']).describe('Type of change to make'),
                        description: z.string().describe('Human-readable description of the change'),
                        reasoning: z.string().describe('Explanation of why this change is needed'),
                        suggested_code: z.string().optional().describe('The code to add or modify (for create/modify/refactor)')
                    };
                } else if (t.name === 'manage_todos') {
                    zodSchema = {
                        action: z.enum(['create', 'update']).describe('Action to perform: create a new TODO or update an existing one'),
                        todo_id: z.string().optional().describe('ID of TODO to update (required for update action). Use exact ID from TODO list.'),
                        content: z.string().optional().describe('Content/description of the TODO (required for create action)'),
                        status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional().describe('Status of the TODO'),
                        notes: z.string().optional().describe('Additional notes about the TODO')
                    };
                } else if (t.name === 'analyze_code') {
                    zodSchema = {
                        file_path: z.string().describe('Path to the file being analyzed'),
                        key_findings: z.string().describe('Key findings or insights about this file'),
                        relevance: z.enum(['high', 'medium', 'low']).describe('Relevance level of this file to the task')
                    };
                } else {
                    // Fallback: use z.any() for unknown tools
                    zodSchema = {};
                }
                
                return tool(
                    t.name,
                    t.description,
                    zodSchema,
                    async (args: any) => {
                        const result = await t.execute(args);
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: JSON.stringify(result)
                                }
                            ]
                        };
                    }
                );
            });

            const mcpServer = createSdkMcpServer({
                name: 'git-board-flow-tools',
                tools: mcpTools
            });

            // Execute query with Agent SDK
            // The query function returns an AsyncGenerator that yields SDKMessage objects
            let result: SDKResultMessage | null = null;
            let finalMessage = '';
            const messages: SDKMessage[] = [];
            
            try {
                const queryResult = query({
                    prompt: userPrompt,
                    options: {
                        model: modelName,
                        systemPrompt: systemPrompt,
                        maxTurns: 30, // Maximum reasoning steps
                        mcpServers: {
                            'git-board-flow-tools': mcpServer
                        },
                        // Advanced configuration options:
                        // - allowedTools: Restrict which tools can be used
                        // - disallowedTools: Block specific tools
                        // - permissionMode: Control tool permissions
                        // - maxBudgetUsd: Set budget limit
                        // - cwd: Set working directory
                        cwd: process.cwd(),
                        // Note: The SDK handles context compression automatically
                        // so we don't need to worry about context limits
                    }
                });

                // Process the async generator
                for await (const message of queryResult) {
                    messages.push(message);
                    
                    // Track result messages
                    if (message.type === 'result') {
                        result = message;
                        if (message.subtype === 'success') {
                            finalMessage = message.result;
                        }
                    }
                    
                    // Track assistant messages for final analysis
                    if (message.type === 'assistant' && message.message.content) {
                        const content = message.message.content;
                        if (Array.isArray(content)) {
                            const textContent = content
                                .filter((c: any) => c.type === 'text')
                                .map((c: any) => c.text)
                                .join('\n');
                            if (textContent) {
                                finalMessage = textContent;
                            }
                        }
                    }
                }
            } catch (agentError: any) {
                logError(`Agent SDK execution error: ${agentError?.message || agentError}`);
                // The SDK provides typed errors like RateLimitError, APIConnectionError, etc.
                throw agentError;
            }

            logInfo(`✅ Agent SDK execution completed. Steps: ${trackedSteps.length}, Changes: ${trackedProposedChanges.length}`);

            // Extract final analysis from SDK result
            let finalAnalysis = finalMessage;
            let agentSteps = 0;
            let totalCost = 0;
            
            if (result) {
                // Extract information from result message
                if (result.subtype === 'success') {
                    finalAnalysis = result.result || finalAnalysis;
                    agentSteps = result.num_turns || 0;
                    totalCost = result.total_cost_usd || 0;
                    
                    logInfo(`💰 Agent SDK Cost: $${totalCost.toFixed(4)} USD`);
                    logInfo(`📊 Usage: ${result.usage.input_tokens} input tokens, ${result.usage.output_tokens} output tokens`);
                } else {
                    // Error result
                    logError(`Agent SDK error: ${result.subtype}`);
                    if (result.errors && result.errors.length > 0) {
                        logError(`Errors: ${result.errors.join(', ')}`);
                    }
                    agentSteps = result.num_turns || 0;
                }
            }
            
            // Log detailed execution summary
            logInfo(`📊 Agent SDK Summary: ${agentSteps} turns, ${trackedSteps.length} tool calls, ${trackedProposedChanges.length} changes proposed`);
            
            // If no final analysis extracted, use a summary
            if (!finalAnalysis || finalAnalysis.trim().length === 0) {
                finalAnalysis = `Analysis completed using Agent SDK. ` +
                    `Processed ${trackedSteps.length} tool calls, ` +
                    `analyzed ${trackedAnalyzedFiles.size} files, ` +
                    `proposed ${trackedProposedChanges.length} changes.`;
            }

            // Return converted results
            return {
                steps: trackedSteps,
                analyzedFiles: trackedAnalyzedFiles,
                proposedChanges: trackedProposedChanges,
                finalAnalysis: finalAnalysis || 'Analysis completed using Agent SDK.'
            };

        } catch (error: any) {
            logError(`Error executing Agent SDK: ${error?.message || error}`);
            logError(`Stack: ${error?.stack || 'No stack trace'}`);
            
            // Return empty results on error - fallback will be used
            return {
                steps: [],
                analyzedFiles: new Map(),
                proposedChanges: [],
                finalAnalysis: `Error executing Agent SDK: ${error?.message || 'Unknown error'}. Using fallback.`
            };
        }
    }

    private async getIssueDescription(param: Execution): Promise<string | null> {
        try {
            const description = await this.issueRepository.getDescription(
                param.owner,
                param.repo,
                param.issueNumber,
                param.tokens.token
            );
            return description ?? null;
        } catch (error) {
            logError(`Error getting issue description: ${error}`);
            return null;
        }
    }

    /**
     * Build a summary from steps when Agent SDK doesn't provide final analysis
     * This avoids using OpenRouter (aiRepository) and keeps everything consistent with Agent SDK
     */
    private buildSummaryFromSteps(
        question: string,
        analyzedFiles: Map<string, FileAnalysis>,
        proposedChanges: ProposedChange[],
        steps: ThinkStep[],
        todoManager: ThinkTodoManager
    ): string {
        const todoStats = todoManager.getStats();
        
        let summary = `## Analysis Summary\n\n`;
        summary += `**Question:** ${question}\n\n`;
        summary += `**Execution Summary:**\n`;
        summary += `- Total steps: ${steps.length}\n`;
        summary += `- Files analyzed: ${analyzedFiles.size}\n`;
        summary += `- Changes proposed: ${proposedChanges.length}\n`;
        
        if (todoStats.total > 0) {
            summary += `- TODO tasks: ${todoStats.total} (${todoStats.completed} completed, ${todoStats.in_progress} in progress, ${todoStats.pending} pending)\n`;
        }
        
        if (analyzedFiles.size > 0) {
            summary += `\n**Key Files Analyzed:**\n`;
            Array.from(analyzedFiles.values()).slice(0, 10).forEach(f => {
                summary += `- ${f.path} (${f.relevance}): ${f.key_findings.substring(0, 100)}${f.key_findings.length > 100 ? '...' : ''}\n`;
            });
        }
        
        if (proposedChanges.length > 0) {
            summary += `\n**Proposed Changes:**\n`;
            proposedChanges.slice(0, 10).forEach(c => {
                summary += `- **${c.change_type.toUpperCase()}** ${c.file_path}: ${c.description}\n`;
            });
            if (proposedChanges.length > 10) {
                summary += `- ... and ${proposedChanges.length - 10} more changes\n`;
            }
        }
        
        summary += `\n**Analysis completed using Claude Agent SDK.**`;
        
        return summary;
    }

    /**
     * Fallback method that uses standard ThinkUseCase logic
     * This is used when Agent SDK is not yet implemented
     * 
     * NOTE: This creates a temporary Execution object with a modified model name
     * to bypass Claude detection and prevent infinite recursion.
     */
    private async useStandardLogicAsFallback(
        param: Execution,
        question: string,
        description: string
    ): Promise<Result[]> {
        // Create a wrapper that modifies the model name to bypass Claude detection
        // This prevents infinite recursion when ThinkUseCase detects Claude again
        class NonClaudeAiWrapper {
            private originalAi: typeof param.ai;
            
            constructor(originalAi: typeof param.ai) {
                this.originalAi = originalAi;
            }
            
            getOpenRouterModel(): string {
                const model = this.originalAi.getOpenRouterModel();
                // Temporarily change model name to bypass Claude detection
                return model.replace(/claude/gi, 'gpt-4').replace(/anthropic/gi, 'openai');
            }
            
            getOpenRouterApiKey(): string {
                return this.originalAi.getOpenRouterApiKey();
            }
            
            getAiIgnoreFiles(): string[] {
                return this.originalAi.getAiIgnoreFiles();
            }
            
            getAiIncludeReasoning(): boolean {
                return this.originalAi.getAiIncludeReasoning();
            }
            
            getProviderRouting() {
                return this.originalAi.getProviderRouting();
            }
        }

        // Create modified param with non-Claude AI wrapper
        const modifiedParam: Execution = Object.create(param);
        modifiedParam.ai = new NonClaudeAiWrapper(param.ai) as unknown as typeof param.ai;

        // Use standard ThinkUseCase (it won't detect Claude now)
        const standardUseCase = new ThinkUseCase();
        return await standardUseCase.invoke(modifiedParam);
    }
}

