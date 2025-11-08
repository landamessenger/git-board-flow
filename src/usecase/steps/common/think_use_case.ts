import { ThinkResponse, ThinkStep, ProposedChange, FileAnalysis } from '../../../data/model/think_response';
import { Execution } from '../../../data/model/execution';
import { Result } from '../../../data/model/result';
import { AiRepository } from '../../../data/repository/ai_repository';
import { FileRepository } from '../../../data/repository/file_repository';
import { IssueRepository } from '../../../data/repository/issue_repository';
import { SupabaseRepository, AICachedFileInfo } from '../../../data/repository/supabase_repository';
import { logDebugInfo, logError, logInfo } from '../../../utils/logger';
import { ParamUseCase } from '../../base/param_usecase';
import { ThinkCodeManager } from './think_code_manager';
import { ThinkTodoManager } from './think_todo_manager';
import { CODEBASE_ANALYSIS_JSON_SCHEMA } from '../../../data/model/codebase_analysis_schema';
import { createHash } from 'crypto';
import { PROMPTS } from '../../../utils/constants';

/**
 * Interface for cached file information
 */
interface CachedFileInfo {
    path: string;
    sha: string;
    description: string;
    consumes: string[];  // Files this file imports
    consumed_by: string[];  // Files that import this file
}

export class ThinkUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'ThinkUseCase';
    private aiRepository: AiRepository = new AiRepository();
    private fileRepository: FileRepository = new FileRepository();
    private issueRepository: IssueRepository = new IssueRepository();
    private supabaseRepository: SupabaseRepository | null = null;
    
    private readonly MAX_ITERATIONS = 30; // Increased to allow deeper analysis
    private readonly MAX_FILES_TO_ANALYZE = 50; // Increased file limit
    private readonly MAX_CONSECUTIVE_SEARCHES = 3; // Max consecutive search_files without progress
    
    async invoke(param: Execution): Promise<Result[]> {
        logInfo(`Executing ${this.taskId}.`);

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
                // For CLI usage, get question from comment body if available
                // This handles the case when think is called as single-action
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
            // AI will create initial TODOs in first iteration if needed

            // Build file index for quick lookup
            const fileIndex = this.buildFileIndex(repositoryFiles);
            
            // STEP 0: Generate codebase analysis and file relationships
            logInfo(`🔍 Step 0: Analyzing codebase structure and file relationships...`);
            const codebaseAnalysis = await this.generateCodebaseAnalysis(
                param,
                repositoryFiles,
                question
            );
            logInfo(`✅ Codebase analysis completed. Analyzed ${codebaseAnalysis.length} files.`);
            
            // Format codebase analysis for context
            const codebaseAnalysisText = this.formatCodebaseAnalysisForContext(codebaseAnalysis);
            
            // Reasoning process
            const steps: ThinkStep[] = [];
            let iteration = 0;
            let complete = false;
            let analyzedFiles: Map<string, FileAnalysis> = new Map();
            let allProposedChanges: ProposedChange[] = [];
            let currentContext = codebaseAnalysisText; // Start with codebase analysis
            let finalAnalysis = '';
            let consecutiveSearches = 0; // Track consecutive search_files without reading
            let lastProgressIteration = 0; // Track last iteration with actual progress
            let filesReadInIteration = 0;
            let seenActions: Map<string, number> = new Map(); // Track action patterns to detect repetition

            while (!complete && iteration < this.MAX_ITERATIONS) {
                iteration++;
                filesReadInIteration = 0;
                logInfo(`🤔 Reasoning iteration ${iteration}/${this.MAX_ITERATIONS}`);

                const thinkResponse = await this.performReasoningStep(
                    param,
                    question,
                    description,
                    codeManager,
                    todoManager,
                    fileIndex,
                    analyzedFiles,
                    currentContext,
                    iteration,
                    steps
                ) as ThinkResponse;

                if (!thinkResponse) {
                    logError('No response from AI reasoning step');
                    break;
                }

                // Handle TODO updates (can be included with any action)
                if (thinkResponse.todo_updates) {
                    // Create new TODOs
                    if (thinkResponse.todo_updates.create) {
                        for (const todo of thinkResponse.todo_updates.create) {
                            const createdTodo = todoManager.createTodo(todo.content, todo.status || 'pending');
                            logInfo(`✅ Created TODO: [${createdTodo.id}] ${todo.content}`);
                        }
                        logInfo(`📋 Created ${thinkResponse.todo_updates.create.length} new TODO items`);
                    }
                    
                    // Update existing TODOs
                    if (thinkResponse.todo_updates.update) {
                        let successCount = 0;
                        let failedIds: string[] = [];
                        
                        for (const update of thinkResponse.todo_updates.update) {
                            const success = todoManager.updateTodo(update.id, {
                                status: update.status,
                                notes: update.notes
                            });
                            if (success) {
                                successCount++;
                            } else {
                                failedIds.push(update.id);
                            }
                        }
                        
                        if (successCount > 0) {
                            logInfo(`📋 Successfully updated ${successCount} TODO items`);
                        }
                        
                        if (failedIds.length > 0) {
                            // Show available TODO IDs to help the AI
                            const allTodos = todoManager.getAllTodos();
                            const availableIds = allTodos.map(t => t.id).join(', ');
                            logInfo(`⚠️ Failed to update ${failedIds.length} TODO items. Available IDs: ${availableIds}`);
                            currentContext += `\n\n⚠️ TODO Update Error: Could not find TODO(s) with ID(s): ${failedIds.join(', ')}. Available TODO IDs are: ${availableIds}. Please use the EXACT ID from the TODO list above.`;
                        }
                    }
                }

                // Record step with associated data for better comment formatting
                const step: ThinkStep = {
                    step_number: iteration,
                    action: thinkResponse.action,
                    reasoning: thinkResponse.reasoning,
                    files_involved: [
                        ...(thinkResponse.files_to_read || []),
                        ...(thinkResponse.files_to_search || []),
                        ...(thinkResponse.analyzed_files?.map(f => f.path) || [])
                    ],
                    findings: thinkResponse.reasoning,
                    timestamp: Date.now()
                };
                
                // Attach proposals to step if they were generated in this step
                if (thinkResponse.action === 'propose_changes' && thinkResponse.proposed_changes) {
                    (step as any).proposals_in_step = thinkResponse.proposed_changes;
                }
                
                // Attach file analysis to step if provided
                if (thinkResponse.action === 'analyze_code' && thinkResponse.analyzed_files) {
                    (step as any).file_analysis_in_step = thinkResponse.analyzed_files;
                }
                
                steps.push(step);

                logInfo(`🤔 Step ${iteration}: ${thinkResponse.action} - ${thinkResponse.reasoning.substring(0, 100)}...`);

                // Track action patterns to detect repetition
                const actionKey = `${thinkResponse.action}_${thinkResponse.files_to_search?.join(',') || thinkResponse.files_to_read?.join(',') || 'general'}`;
                const actionCount = seenActions.get(actionKey) || 0;
                seenActions.set(actionKey, actionCount + 1);
                
                // Execute action
                switch (thinkResponse.action) {
                    case 'search_files':
                        consecutiveSearches++;
                        if (thinkResponse.files_to_search && thinkResponse.files_to_search.length > 0) {
                            const foundFiles = this.searchFiles(thinkResponse.files_to_search, fileIndex);
                            logInfo(`🔍 Search results: Found ${foundFiles.length} files for terms: ${thinkResponse.files_to_search.join(', ')}`);
                            
                            // Detect if we're repeating the same search
                            if (actionCount > 1) {
                                currentContext += `\n\n⚠️ WARNING: You've already searched for "${thinkResponse.files_to_search.join(', ')}" ${actionCount} times. `;
                                if (foundFiles.length > 0) {
                                    currentContext += `These files were found previously. Consider READING them instead of searching again.`;
                                } else {
                                    currentContext += `No files found. Consider trying different search terms or reading files from the list above.`;
                                }
                            }
                            
                            if (foundFiles.length > 0) {
                                currentContext += `\n\nFound ${foundFiles.length} files matching search criteria:\n${foundFiles.map(f => `- ${f}`).join('\n')}`;
                                
                                // If found files after multiple searches, suggest reading them
                                if (consecutiveSearches >= this.MAX_CONSECUTIVE_SEARCHES && foundFiles.length > 0) {
                                    currentContext += `\n\n💡 IMPORTANT: You've searched ${consecutiveSearches} times. You MUST read some of the found files now to proceed with analysis. Suggested files: ${foundFiles.slice(0, 5).join(', ')}`;
                                }
                            } else {
                                currentContext += `\n\nNo files found matching search criteria: ${thinkResponse.files_to_search.join(', ')}. Available files in repository: ${Array.from(repositoryFiles.keys()).slice(0, 30).join(', ')}...`;
                                
                                // If too many searches without finding files, provide full file list
                                if (consecutiveSearches >= this.MAX_CONSECUTIVE_SEARCHES) {
                                    currentContext += `\n\n📋 Here are all available files in the repository to help you:\n${Array.from(repositoryFiles.keys()).map((f, i) => `${i + 1}. ${f}`).slice(0, 100).join('\n')}${repositoryFiles.size > 100 ? '\n... and more' : ''}`;
                                }
                            }
                        }
                        break;

                    case 'read_file':
                        consecutiveSearches = 0; // Reset counter when reading files
                        if (thinkResponse.files_to_read && thinkResponse.files_to_read.length > 0) {
                            const filesToAnalyze = thinkResponse.files_to_read.slice(0, this.MAX_FILES_TO_ANALYZE - analyzedFiles.size);
                            logInfo(`📖 Reading ${filesToAnalyze.length} files: ${filesToAnalyze.join(', ')}`);
                            
                            for (const filePath of filesToAnalyze) {
                                if (analyzedFiles.has(filePath)) {
                                    logDebugInfo(`⏭️ Skipping already analyzed file: ${filePath}`);
                                    continue; // Already analyzed
                                }

                                // Get content from virtual files (includes applied changes)
                                const content = codeManager.getFileContent(filePath);
                                if (content !== undefined) {
                                    filesReadInIteration++;
                                    const isModified = codeManager.isFileModified(filePath);
                                    const modificationNote = isModified ? ` [MODIFIED - ${codeManager.getFileChanges(filePath).length} change(s) applied]` : '';
                                    logDebugInfo(`✅ Reading file: ${filePath} (${content.length} chars)${modificationNote}`);
                                    
                                    // Show current state with applied changes
                                    currentContext += `\n\n=== File: ${filePath}${modificationNote} ===\n${content.substring(0, 8000)}${content.length > 8000 ? '\n... (truncated)' : ''}`;
                                    
                                    // If file was modified, show what changed
                                    if (isModified) {
                                        const changes = codeManager.getFileChanges(filePath);
                                        currentContext += `\n\n⚠️ This file has been modified in previous steps. Changes applied: ${changes.map(c => `${c.change_type}: ${c.description}`).join(', ')}`;
                                    }
                                    
                                    lastProgressIteration = iteration;
                                } else {
                                    logInfo(`❌ File not found in repository: ${filePath}`);
                                    // Try to find similar file names
                                    const fileName = filePath.split('/').pop() || '';
                                    const similarFiles = Array.from(repositoryFiles.keys()).filter(f => 
                                        f.toLowerCase().includes(fileName.toLowerCase()) || 
                                        f.split('/').pop()?.toLowerCase().includes(fileName.toLowerCase())
                                    ).slice(0, 5);
                                    currentContext += `\n\n⚠️ File not found: ${filePath}. ${similarFiles.length > 0 ? `Similar files found: ${similarFiles.join(', ')}` : 'Please check the file path.'}`;
                                }
                            }
                        }
                        break;

                    case 'analyze_code':
                        consecutiveSearches = 0; // Reset counter when analyzing
                        if (thinkResponse.analyzed_files && thinkResponse.analyzed_files.length > 0) {
                            const beforeCount = analyzedFiles.size;
                            for (const analysis of thinkResponse.analyzed_files) {
                                if (!analyzedFiles.has(analysis.path)) {
                                    analyzedFiles.set(analysis.path, analysis);
                                }
                            }
                            
                            if (analyzedFiles.size > beforeCount) {
                                lastProgressIteration = iteration;
                            }
                            
                            const findings = thinkResponse.analyzed_files
                                .map(f => `${f.path} (${f.relevance}): ${f.key_findings}`)
                                .join('\n');
                            currentContext += `\n\nAnalysis findings:\n${findings}`;
                        }
                        break;

                    case 'propose_changes':
                        consecutiveSearches = 0; // Reset counter when proposing changes
                        if (thinkResponse.proposed_changes && thinkResponse.proposed_changes.length > 0) {
                            // Filter out changes that have already been applied
                            const newChanges = thinkResponse.proposed_changes.filter(change => 
                                !codeManager.hasChangeBeenApplied(change)
                            );
                            
                            if (newChanges.length === 0) {
                                logInfo(`⚠️ All proposed changes have already been applied. Skipping duplicates.`);
                                currentContext += `\n\n⚠️ All proposed changes in this step have already been applied in previous iterations. Please propose NEW changes or move to the next step.`;
                                break;
                            }
                            
                            // Apply changes to virtual codebase
                            let appliedCount = 0;
                            for (const change of newChanges) {
                                if (codeManager.applyChange(change)) {
                                    appliedCount++;
                                    allProposedChanges.push(change);
                                }
                            }
                            
                            logInfo(`✅ Applied ${appliedCount} new changes to virtual codebase (${newChanges.length - appliedCount} skipped)`);
                            
                            // Auto-update TODOs based on applied changes
                            todoManager.autoUpdateFromChanges(newChanges.slice(0, appliedCount));
                            
                            // Store the index where these proposals start for proper ordering
                            const startIndex = allProposedChanges.length - appliedCount;
                            const appliedChanges = newChanges.slice(0, appliedCount);
                            
                            // Attach to step with start index for proper display order
                            const currentStep = steps[steps.length - 1];
                            if (currentStep) {
                                (currentStep as any).proposals_in_step = appliedChanges;
                                (currentStep as any).proposals_start_index = startIndex;
                            }
                            
                            const changesSummary = appliedChanges
                                .map(c => `${c.change_type} ${c.file_path}: ${c.description}`)
                                .join('\n');
                            currentContext += `\n\n✅ Applied ${appliedCount} new changes to codebase:\n${changesSummary}`;
                            
                            // Add context about code state
                            currentContext += codeManager.getContextForAI();
                            
                            lastProgressIteration = iteration;
                        }
                        break;

                    case 'update_todos':
                        consecutiveSearches = 0; // Reset counter when updating TODOs
                        // Note: TODO updates are handled before the switch statement
                        // This case is mainly for when action is explicitly update_todos
                        if (thinkResponse.todo_updates && (
                            !thinkResponse.files_to_search && 
                            !thinkResponse.files_to_read && 
                            !thinkResponse.analyzed_files && 
                            !thinkResponse.proposed_changes
                        )) {
                            // Pure TODO update action - warn if this happens too often
                            logInfo(`📋 Pure TODO update action (no other work done)`);
                            currentContext += `\n\n📋 TODO list updated. Current status:\n${todoManager.getContextForAI()}`;
                            currentContext += `\n\n⚠️ **NOTE**: You updated TODOs but didn't do any actual work. In the next iteration, DO THE WORK: search for files, read files, analyze code, or propose changes related to the active TODOs.`;
                            lastProgressIteration = iteration;
                        }
                        break;

                    case 'complete':
                        complete = true;
                        finalAnalysis = thinkResponse.final_analysis || thinkResponse.reasoning;
                        lastProgressIteration = iteration;
                        break;
                }

                // Check for stagnation - if too many iterations without progress
                const iterationsWithoutProgress = iteration - lastProgressIteration;
                if (iterationsWithoutProgress > 5 && !complete && iteration > 5) {
                    logInfo(`⚠️ No significant progress in last ${iterationsWithoutProgress} iterations (last progress at iteration ${lastProgressIteration}). Forcing completion.`);
                    complete = true;
                    if (!finalAnalysis) {
                        finalAnalysis = `Analysis completed after ${iteration} iterations. Analyzed ${analyzedFiles.size} files, proposed ${allProposedChanges.length} changes.`;
                    }
                }
                
                // Check if stuck in TODO update loop
                const recentActions = steps.slice(-3).map(s => s.action);
                const allUpdateTodos = recentActions.every(a => a === 'update_todos');
                if (allUpdateTodos && recentActions.length >= 3 && iteration > 3) {
                    logInfo(`⚠️ Detected loop: ${recentActions.length} consecutive update_todos actions. Warning AI to do actual work.`);
                    const activeTodos = todoManager.getActiveTodos();
                    const todoIds = activeTodos.map(t => t.id).join(', ');
                    currentContext += `\n\n⚠️ **STOP UPDATING TODOs AND DO ACTUAL WORK**: You've been updating TODOs repeatedly. Pick a TODO to work on (IDs: ${todoIds}) and DO THE WORK: search for files, read files, analyze code, or propose changes. Stop just updating TODO status!`;
                }

                // Prevent infinite loops - check file limit
                if (analyzedFiles.size >= this.MAX_FILES_TO_ANALYZE) {
                    logInfo(`Reached maximum files to analyze (${this.MAX_FILES_TO_ANALYZE})`);
                    if (!complete) {
                        complete = true;
                        finalAnalysis = finalAnalysis || `Reached maximum file limit. Analyzed ${analyzedFiles.size} files, proposed ${allProposedChanges.length} changes.`;
                    }
                    break;
                }
            }

            // Generate final comprehensive response
            if (!finalAnalysis && complete) {
                finalAnalysis = await this.generateFinalAnalysis(param, question, analyzedFiles, allProposedChanges, steps, todoManager);
            }

            // Format and post comprehensive reasoning comment
            const formattedComment = this.formatReasoningComment(
                question,
                description,
                steps,
                analyzedFiles,
                allProposedChanges,
                finalAnalysis,
                iteration,
                todoManager
            );

            // Determine issue number
            let issueNumber = param.issueNumber;
            if (param.singleAction.isThinkAction && issueNumber <= 0) {
                // Try to get from issue if available
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
                        final_analysis: finalAnalysis,
                        total_iterations: iteration,
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

    private buildFileIndex(files: Map<string, string>): Map<string, string[]> {
        const index = new Map<string, string[]>();
        
        for (const [path, content] of files.entries()) {
            const pathParts = path.split('/');
            const fileName = pathParts[pathParts.length - 1];
            
            // Index by filename
            if (!index.has(fileName)) {
                index.set(fileName, []);
            }
            index.get(fileName)!.push(path);
            
            // Index by directory
            if (pathParts.length > 1) {
                const dir = pathParts.slice(0, -1).join('/');
                if (!index.has(dir)) {
                    index.set(dir, []);
                }
                index.get(dir)!.push(path);
            }
        }
        
        return index;
    }

    private searchFiles(searchTerms: string[], fileIndex: Map<string, string[]>): string[] {
        const foundFiles = new Set<string>();
        
        for (const term of searchTerms) {
            // Exact filename match
            if (fileIndex.has(term)) {
                fileIndex.get(term)!.forEach(f => foundFiles.add(f));
            }
            
            // Directory match
            if (fileIndex.has(term)) {
                fileIndex.get(term)!.forEach(f => foundFiles.add(f));
            }
            
            // Pattern match (simple contains)
            for (const [key, paths] of fileIndex.entries()) {
                if (key.toLowerCase().includes(term.toLowerCase())) {
                    paths.forEach(p => foundFiles.add(p));
                }
                // Also check paths
                paths.forEach(path => {
                    if (path.toLowerCase().includes(term.toLowerCase())) {
                        foundFiles.add(path);
                    }
                });
            }
        }
        
        return Array.from(foundFiles);
    }

    /**
     * Extract imports from a file regardless of programming language
     */
    private extractImportsFromFile(filePath: string, content: string): string[] {
        const imports: string[] = [];
        const ext = filePath.split('.').pop()?.toLowerCase() || '';
        const dir = filePath.split('/').slice(0, -1).join('/') || '';
        
        // TypeScript/JavaScript
        if (['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'].includes(ext)) {
            // import ... from '...'
            const es6Imports = content.match(/import\s+.*?\s+from\s+['"]([^'"]+)['"]/g) || [];
            es6Imports.forEach(match => {
                const path = match.match(/['"]([^'"]+)['"]/)?.[1];
                if (path) imports.push(path);
            });
            
            // require('...')
            const requireImports = content.match(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/g) || [];
            requireImports.forEach(match => {
                const path = match.match(/['"]([^'"]+)['"]/)?.[1];
                if (path) imports.push(path);
            });
        }
        
        // Python
        if (['py', 'pyw', 'pyi'].includes(ext)) {
            // import ... / from ... import ...
            const pyImports = content.match(/(?:^|\n)\s*(?:import\s+\w+|from\s+[\w.]+)\s+import/gm) || [];
            pyImports.forEach(match => {
                const fromMatch = match.match(/from\s+([\w.]+)/);
                if (fromMatch) {
                    imports.push(fromMatch[1]);
                } else {
                    const importMatch = match.match(/import\s+(\w+)/);
                    if (importMatch) imports.push(importMatch[1]);
                }
            });
        }
        
        // Java
        if (ext === 'java') {
            const javaImports = content.match(/import\s+(?:static\s+)?[\w.]+\s*;/g) || [];
            javaImports.forEach(match => {
                const path = match.replace(/import\s+(?:static\s+)?/, '').replace(/\s*;/, '');
                imports.push(path);
            });
        }
        
        // Kotlin
        if (['kt', 'kts'].includes(ext)) {
            const ktImports = content.match(/import\s+[\w.]+\s*/g) || [];
            ktImports.forEach(match => {
                const path = match.replace(/import\s+/, '').trim();
                imports.push(path);
            });
        }
        
        // Go
        if (ext === 'go') {
            const goImports = content.match(/import\s*(?:\([^)]+\)|['"]([^'"]+)['"])/gs) || [];
            goImports.forEach(match => {
                const quoted = match.match(/['"]([^'"]+)['"]/);
                if (quoted) {
                    imports.push(quoted[1]);
                } else {
                    // Multi-line import block
                    const multiLine = match.match(/import\s*\(([^)]+)\)/s);
                    if (multiLine) {
                        const paths = multiLine[1].match(/['"]([^'"]+)['"]/g) || [];
                        paths.forEach(p => {
                            const path = p.match(/['"]([^'"]+)['"]/)?.[1];
                            if (path) imports.push(path);
                        });
                    }
                }
            });
        }
        
        // Rust
        if (ext === 'rs') {
            const rustImports = content.match(/use\s+[\w:]+(?:::\*)?\s*;/g) || [];
            rustImports.forEach(match => {
                const path = match.replace(/use\s+/, '').replace(/\s*;/, '').split('::')[0];
                imports.push(path);
            });
        }
        
        // Ruby
        if (ext === 'rb') {
            const rubyImports = content.match(/(?:require|require_relative)\s+['"]([^'"]+)['"]/g) || [];
            rubyImports.forEach(match => {
                const path = match.match(/['"]([^'"]+)['"]/)?.[1];
                if (path) imports.push(path);
            });
        }
        
        // PHP
        if (ext === 'php') {
            const phpImports = content.match(/(?:use|require|include)(?:_once)?\s+['"]([^'"]+)['"]/g) || [];
            phpImports.forEach(match => {
                const path = match.match(/['"]([^'"]+)['"]/)?.[1];
                if (path) imports.push(path);
            });
        }
        
        // Swift
        if (ext === 'swift') {
            const swiftImports = content.match(/import\s+\w+/g) || [];
            swiftImports.forEach(match => {
                const path = match.replace(/import\s+/, '');
                imports.push(path);
            });
        }
        
        // Dart
        if (ext === 'dart') {
            const dartImports = content.match(/import\s+['"]([^'"]+)['"]/g) || [];
            dartImports.forEach(match => {
                const path = match.match(/['"]([^'"]+)['"]/)?.[1];
                if (path) imports.push(path);
            });
        }
        
        // Resolve relative imports to absolute paths
        return imports.map(imp => {
            // Skip external packages (node_modules, stdlib, etc.)
            if (!imp.startsWith('.') && !imp.startsWith('/')) {
                // Try to resolve relative to current file
                if (dir) {
                    // Check if it's a relative path that needs resolution
                    const possiblePath = `${dir}/${imp}`.replace(/\/+/g, '/');
                    return possiblePath;
                }
                return imp;
            }
            
            // Resolve relative paths
            if (imp.startsWith('.')) {
                const resolved = this.resolveRelativePath(dir, imp);
                return resolved;
            }
            
            return imp;
        }).filter(imp => imp && !imp.includes('node_modules') && !imp.startsWith('http'));
    }
    
    /**
     * Resolve relative import path to absolute path
     */
    private resolveRelativePath(baseDir: string, relativePath: string): string {
        if (!relativePath.startsWith('.')) {
            return relativePath;
        }
        
        let path = baseDir || '';
        const parts = relativePath.split('/');
        
        for (const part of parts) {
            if (part === '..') {
                path = path.split('/').slice(0, -1).join('/');
            } else if (part === '.' || part === '') {
                // Current directory, do nothing
            } else {
                path = path ? `${path}/${part}` : part;
            }
        }
        
        // Remove file extension if present and add common extensions
        const withoutExt = path.replace(/\.(ts|tsx|js|jsx|py|java|kt|go|rs|rb|php|swift|dart)$/, '');
        
        return withoutExt;
    }

    /**
     * Calculate SHA256 hash of file content
     */
    private calculateFileSHA(content: string): string {
        return createHash('sha256').update(content).digest('hex');
    }

    /**
     * Initialize Supabase repository if config is available
     */
    private initSupabaseRepository(param: Execution): void {
        if (!this.supabaseRepository && param.supabaseConfig) {
            this.supabaseRepository = new SupabaseRepository(param.supabaseConfig);
        }
    }

    /**
     * Load cache from Supabase (or return empty map if Supabase not available)
     */
    private async loadAICache(param: Execution): Promise<Map<string, CachedFileInfo>> {
        this.initSupabaseRepository(param);
        const cache = new Map<string, CachedFileInfo>();

        if (!this.supabaseRepository) {
            logInfo(`📂 Supabase not configured, starting with empty cache`);
            return cache;
        }

        try {
            const branch = param.commit.branch || param.branches.main;
            const cachedFiles = await this.supabaseRepository.getAIFileCachesByBranch(
                param.owner,
                param.repo,
                branch
            );

            for (const file of cachedFiles) {
                cache.set(file.path, {
                    path: file.path,
                    sha: file.sha,
                    description: file.description,
                    consumes: file.consumes || [],
                    consumed_by: file.consumed_by || []
                });
            }

            logInfo(`📂 Loaded ${cache.size} files from Supabase cache`);
        } catch (error) {
            logError(`Error loading AI cache from Supabase: ${error}`);
        }

        return cache;
    }

    /**
     * Save cache entry to Supabase
     */
    private async saveAICacheEntry(
        param: Execution,
        filePath: string,
        fileInfo: CachedFileInfo,
        consumes: string[],
        consumedBy: string[]
    ): Promise<void> {
        this.initSupabaseRepository(param);

        if (!this.supabaseRepository) {
            return; // Silently skip if Supabase not available
        }

        try {
            const branch = param.commit.branch || param.branches.main;
            const fileName = filePath.split('/').pop() || filePath;

            await this.supabaseRepository.setAIFileCache(
                param.owner,
                param.repo,
                branch,
                {
                    file_name: fileName,
                    path: filePath,
                    sha: fileInfo.sha,
                    description: fileInfo.description,
                    consumes: consumes,
                    consumed_by: consumedBy
                }
            );
        } catch (error) {
            logError(`Error saving AI cache entry to Supabase for ${filePath}: ${error}`);
        }
    }

    /**
     * Build relationship map from all files by extracting imports
     * Also builds reverse map (consumed_by)
     */
    private buildRelationshipMap(
        repositoryFiles: Map<string, string>
    ): { consumes: Map<string, string[]>, consumedBy: Map<string, string[]> } {
        const consumesMap = new Map<string, string[]>();
        const consumedByMap = new Map<string, string[]>();
        
        logInfo(`🔗 Building relationship map from imports...`);
        
        // Initialize consumedBy map for all files
        for (const filePath of repositoryFiles.keys()) {
            consumedByMap.set(filePath, []);
        }
        
        for (const [filePath, content] of repositoryFiles.entries()) {
            const imports = this.extractImportsFromFile(filePath, content);
            
            // Resolve imports to actual file paths in the repository
            const resolvedImports: string[] = [];
            
            for (const imp of imports) {
                // Try to find matching file in repository
                const possiblePaths = [
                    imp,
                    `${imp}.ts`,
                    `${imp}.tsx`,
                    `${imp}.js`,
                    `${imp}.jsx`,
                    `${imp}/index.ts`,
                    `${imp}/index.tsx`,
                    `${imp}/index.js`,
                    `${imp}/index.jsx`,
                ];
                
                for (const possiblePath of possiblePaths) {
                    // Check exact match
                    if (repositoryFiles.has(possiblePath)) {
                        if (!resolvedImports.includes(possiblePath)) {
                            resolvedImports.push(possiblePath);
                        }
                        // Update reverse map
                        const currentConsumers = consumedByMap.get(possiblePath) || [];
                        if (!currentConsumers.includes(filePath)) {
                            currentConsumers.push(filePath);
                            consumedByMap.set(possiblePath, currentConsumers);
                        }
                        break;
                    }
                    
                    // Check if any file path contains this import
                    for (const [repoPath] of repositoryFiles.entries()) {
                        if (repoPath.includes(possiblePath) || possiblePath.includes(repoPath)) {
                            if (!resolvedImports.includes(repoPath)) {
                                resolvedImports.push(repoPath);
                            }
                            // Update reverse map
                            const currentConsumers = consumedByMap.get(repoPath) || [];
                            if (!currentConsumers.includes(filePath)) {
                                currentConsumers.push(filePath);
                                consumedByMap.set(repoPath, currentConsumers);
                            }
                        }
                    }
                }
            }
            
            consumesMap.set(filePath, resolvedImports);
        }
        
        logInfo(`✅ Built relationship map for ${consumesMap.size} files`);
        return { consumes: consumesMap, consumedBy: consumedByMap };
    }

    /**
     * Generate codebase analysis with file descriptions and relationships
     * This runs before the main reasoning loop to provide context
     * Uses relationship map built from imports + AI descriptions in batches
     */
    private async generateCodebaseAnalysis(
        param: Execution,
        repositoryFiles: Map<string, string>,
        question: string
    ): Promise<Array<{ path: string; description: string; consumes: string[]; consumed_by: string[] }>> {
        try {
            // Filter relevant files (code files, not config/docs)
            const codeExtensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.kt', '.go', '.rs', '.rb', '.php', '.swift', '.dart'];
            const relevantFiles = Array.from(repositoryFiles.entries())
                .filter(([path]) => {
                    const ext = path.split('.').pop()?.toLowerCase() || '';
                    return codeExtensions.includes(`.${ext}`) || 
                           path.includes('/src/') || 
                           path.includes('/lib/') ||
                           path.includes('/usecase/') ||
                           path.includes('/repository/');
                });

            if (relevantFiles.length === 0) {
                logInfo(`⚠️ No relevant code files found for analysis`);
                return [];
            }

            logInfo(`🔍 Analyzing ${relevantFiles.length} relevant files for structure and relationships...`);
            
            // STEP 0: Load cache from Supabase
            const cache = await this.loadAICache(param);
            
            // STEP 1: Build relationship map from imports (in memory, no AI needed)
            const relationshipMaps = this.buildRelationshipMap(repositoryFiles);
            const consumesMap = relationshipMaps.consumes;
            const consumedByMap = relationshipMaps.consumedBy;

            // STEP 2: Identify files that need AI analysis (not in cache or SHA changed)
            const filesNeedingAnalysis: Array<[string, string]> = [];
            const cachedAnalyses: Array<{ path: string; description: string; consumes: string[]; consumed_by: string[] }> = [];
            
            let cacheMissReasons = {
                notInCache: 0,
                shaMismatch: 0
            };
            
            for (const [filePath, content] of relevantFiles) {
                const currentSHA = this.calculateFileSHA(content);
                const cached = cache.get(filePath);
                
                if (!cached) {
                    cacheMissReasons.notInCache++;
                    filesNeedingAnalysis.push([filePath, content]);
                } else if (cached.sha !== currentSHA) {
                    cacheMissReasons.shaMismatch++;
                    logDebugInfo(`🔄 SHA mismatch for ${filePath}: cached=${cached.sha.substring(0, 8)}..., current=${currentSHA.substring(0, 8)}...`);
                    filesNeedingAnalysis.push([filePath, content]);
                } else {
                    // Use cached data
                    const consumes = consumesMap.get(filePath) || [];
                    const consumedBy = consumedByMap.get(filePath) || [];
                    cachedAnalyses.push({
                        path: filePath,
                        description: cached.description,
                        consumes: consumes,
                        consumed_by: consumedBy
                    });
                }
            }
            
            logInfo(`📊 Cache hit: ${cachedAnalyses.length} files, Need analysis: ${filesNeedingAnalysis.length} files (not in cache: ${cacheMissReasons.notInCache}, SHA mismatch: ${cacheMissReasons.shaMismatch})`);
            
            // Debug: Show sample of cache keys vs relevant file paths
            if (cacheMissReasons.notInCache > 0 && cache.size > 0) {
                const sampleCachePaths = Array.from(cache.keys()).slice(0, 5);
                const sampleRelevantPaths = relevantFiles.slice(0, 5).map(([path]) => path);
                logDebugInfo(`🔍 Sample cache paths: ${sampleCachePaths.join(', ')}`);
                logDebugInfo(`🔍 Sample relevant paths: ${sampleRelevantPaths.join(', ')}`);
            }

            // STEP 3: Process files needing analysis in batches with AI (only for descriptions)
            // Relationships come from the map we built
            const BATCH_SIZE = 20; // Process 20 files at a time
            const allAnalyses: Array<{ path: string; description: string; consumes: string[]; consumed_by: string[] }> = [...cachedAnalyses];
            
            // Create simplified schema for AI (only needs description, relationships come from map)
            const FILE_DESCRIPTION_SCHEMA = {
                "type": "array",
                "description": "Array of file descriptions",
                "items": {
                    "type": "object",
                    "properties": {
                        "path": {
                            "type": "string",
                            "description": "File path relative to repository root"
                        },
                        "description": {
                            "type": "string",
                            "description": "Complete description of what the file does"
                        }
                    },
                    "required": ["path", "description"],
                    "additionalProperties": false
                }
            };
            
            for (let i = 0; i < filesNeedingAnalysis.length; i += BATCH_SIZE) {
                const batch = filesNeedingAnalysis.slice(i, i + BATCH_SIZE);
                const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
                const totalBatches = Math.ceil(relevantFiles.length / BATCH_SIZE);
                
                logInfo(`📝 Processing batch ${batchNumber}/${totalBatches} (${batch.length} files)...`);
                
                // Prepare batch content
                const batchFilesList = batch.map(([path]) => path).join('\n');
                const batchContent = batch.map(([path, content]) => 
                    `\n## ${path}\n\`\`\`\n${content}\n\`\`\``
                ).join('\n');
                
                const batchPrompt = `# Codebase Structure Analysis - Batch ${batchNumber}/${totalBatches}

You are analyzing a codebase to understand what each file does.

## User's Question:
${question}

## Files to Analyze in this batch (${batch.length} files):
${batchFilesList}

## File Contents:
${batchContent}

## Task:
For EACH of the ${batch.length} files listed above, 

${PROMPTS.CODE_BASE_ANALYSIS}

Return a JSON array with this structure:
[
  {
    "path": "src/path/to/file.ts",
    "description": "description_here"
  },
  ...
]

**REQUIREMENTS**:
- You MUST return a description for ALL ${batch.length} files in this batch`;

                try {
                    const batchResponse = await this.aiRepository.askJson(
                        param.ai,
                        batchPrompt,
                        FILE_DESCRIPTION_SCHEMA,
                        "file_descriptions"
                    );
                    
                    if (batchResponse && Array.isArray(batchResponse)) {
                        // Merge AI descriptions with relationship map and update cache
                        for (const item of batchResponse) {
                            if (item && typeof item.path === 'string' && typeof item.description === 'string') {
                                const [filePath, content] = batch.find(([p]) => p === item.path) || [item.path, ''];
                                const currentSHA = filePath && content ? this.calculateFileSHA(content) : '';
                                const consumes = consumesMap.get(item.path) || [];
                                const consumedBy = consumedByMap.get(item.path) || [];
                                
                                allAnalyses.push({
                                    path: item.path,
                                    description: item.description,
                                    consumes: consumes,
                                    consumed_by: consumedBy
                                });
                                
                                // Update cache
                                if (filePath && currentSHA) {
                                    const cachedInfo: CachedFileInfo = {
                                        path: item.path,
                                        sha: currentSHA,
                                        description: item.description,
                                        consumes: consumes,
                                        consumed_by: consumedBy
                                    };
                                    cache.set(item.path, cachedInfo);
                                    // Save to Supabase
                                    await this.saveAICacheEntry(param, item.path, cachedInfo, consumes, consumedBy);
                                }
                            }
                        }
                        logInfo(`✅ Processed batch ${batchNumber}/${totalBatches}: ${batchResponse.length} files`);
                    } else {
                        logError(`⚠️ Batch ${batchNumber} failed, using fallback descriptions`);
                        // Fallback for this batch
                        for (const [path, content] of batch) {
                            const currentSHA = this.calculateFileSHA(content);
                            const consumes = consumesMap.get(path) || [];
                            const consumedBy = consumedByMap.get(path) || [];
                            const fallbackDesc = this.generateBasicDescription(path);
                            
                            allAnalyses.push({
                                path,
                                description: fallbackDesc,
                                consumes: consumes,
                                consumed_by: consumedBy
                            });
                            
                            // Update cache with fallback
                            const cachedInfo: CachedFileInfo = {
                                path,
                                sha: currentSHA,
                                description: fallbackDesc,
                                consumes: consumes,
                                consumed_by: consumedBy
                            };
                            cache.set(path, cachedInfo);
                            // Save to Supabase
                            await this.saveAICacheEntry(param, path, cachedInfo, consumes, consumedBy);
                        }
                    }
                } catch (error) {
                    logError(`Error processing batch ${batchNumber}: ${error}`);
                    // Fallback for this batch
                    for (const [path, content] of batch) {
                        const currentSHA = this.calculateFileSHA(content);
                        const consumes = consumesMap.get(path) || [];
                        const consumedBy = consumedByMap.get(path) || [];
                        const fallbackDesc = this.generateBasicDescription(path);
                        
                        allAnalyses.push({
                            path,
                            description: fallbackDesc,
                            consumes: consumes,
                            consumed_by: consumedBy
                        });
                        
                        // Update cache with fallback
                        const cachedInfo: CachedFileInfo = {
                            path,
                            sha: currentSHA,
                            description: fallbackDesc,
                            consumes: consumes,
                            consumed_by: consumedBy
                        };
                        cache.set(path, cachedInfo);
                        // Save to Supabase
                        await this.saveAICacheEntry(param, path, cachedInfo, consumes, consumedBy);
                    }
                }
            }
            
            // STEP 4: Cache is saved incrementally during processing
            // No need to save all at once since we're using Supabase
            
            if (allAnalyses.length > 0) {
                logInfo(`✅ Generated analysis for ${allAnalyses.length} files (${cachedAnalyses.length} from cache, ${filesNeedingAnalysis.length} from AI)`);
                return allAnalyses;
            }

            // Fallback: Generate simple descriptions based on file paths and basic content
            logInfo(`⚠️ AI analysis failed, generating fallback descriptions...`);
            const fallbackDescriptions = this.generateFallbackFileDescriptions(relevantFiles);
            // Merge with relationship maps and update cache
            const fallbackResults = await Promise.all(fallbackDescriptions.map(async (item) => {
                const consumes = consumesMap.get(item.path) || [];
                const consumedBy = consumedByMap.get(item.path) || [];
                const content = repositoryFiles.get(item.path) || '';
                const currentSHA = content ? this.calculateFileSHA(content) : '';
                
                // Update cache
                if (content && currentSHA) {
                    const cachedInfo: CachedFileInfo = {
                        path: item.path,
                        sha: currentSHA,
                        description: item.description,
                        consumes: consumes,
                        consumed_by: consumedBy
                    };
                    cache.set(item.path, cachedInfo);
                    // Save to Supabase
                    await this.saveAICacheEntry(param, item.path, cachedInfo, consumes, consumedBy);
                }
                
                return {
                    ...item,
                    consumes: consumes,
                    consumed_by: consumedBy
                };
            }));
            
            // Cache is saved incrementally during processing
            // No need to save all at once since we're using Supabase
            
            return fallbackResults;
            
        } catch (error) {
            logError(`Error generating codebase analysis: ${error}`);
            // Fallback to simple path-based analysis
            const relevantFiles = Array.from(repositoryFiles.entries())
                .filter(([path]) => path.includes('/src/') || path.includes('/lib/'));
            const fallbackDescriptions = this.generateFallbackFileDescriptions(relevantFiles);
            // Try to build relationship map even in fallback
            try {
                const relationshipMaps = this.buildRelationshipMap(repositoryFiles);
                const consumes = relationshipMaps.consumes;
                const consumedBy = relationshipMaps.consumedBy;
                return fallbackDescriptions.map(item => ({
                    ...item,
                    consumes: consumes.get(item.path) || [],
                    consumed_by: consumedBy.get(item.path) || []
                }));
            } catch {
                return fallbackDescriptions;
            }
        }
    }

    /**
     * Generate basic description from file path (fallback)
     */
    private generateBasicDescription(path: string): string {
        const pathParts = path.split('/');
        const fileName = pathParts[pathParts.length - 1];
        const dir = pathParts.slice(0, -1).join('/');
        
        if (path.includes('/usecase/')) {
            return `Use case for ${fileName.replace(/_/g, ' ').replace(/\.(ts|tsx|js|jsx|py|java|kt|go|rs|rb|php|swift|dart)$/, '')}. Handles business logic and orchestrates operations.`;
        } else if (path.includes('/repository/')) {
            return `Repository for ${fileName.replace(/_/g, ' ').replace(/\.(ts|tsx|js|jsx|py|java|kt|go|rs|rb|php|swift|dart)$/, '')}. Handles data access and external service interactions.`;
        } else if (path.includes('/model/')) {
            return `Data model: ${fileName.replace(/_/g, ' ').replace(/\.(ts|tsx|js|jsx|py|java|kt|go|rs|rb|php|swift|dart)$/, '')}. Defines data structures and interfaces.`;
        } else if (path.includes('/utils/')) {
            return `Utility functions: ${fileName.replace(/_/g, ' ').replace(/\.(ts|tsx|js|jsx|py|java|kt|go|rs|rb|php|swift|dart)$/, '')}. Provides helper functions and utilities.`;
        } else if (path.includes('/actions/')) {
            return `Action handler: ${fileName.replace(/_/g, ' ').replace(/\.(ts|tsx|js|jsx|py|java|kt|go|rs|rb|php|swift|dart)$/, '')}. Handles action execution and workflows.`;
        } else {
            return `File: ${fileName}. Located in ${dir || 'root'}.`;
        }
    }

    /**
     * Generate fallback file descriptions when AI analysis fails
     */
    private generateFallbackFileDescriptions(
        files: Array<[string, string]>
    ): Array<{ path: string; description: string; consumes: string[]; consumed_by: string[] }> {
        const descriptions: Array<{ path: string; description: string; consumes: string[]; consumed_by: string[] }> = [];
        
        for (const [path] of files) {
            const description = this.generateBasicDescription(path);
            descriptions.push({
                path,
                description,
                consumes: [], // Will be filled by relationship map
                consumed_by: [] // Will be filled by relationship map
            });
        }

        return descriptions;
    }

    /**
     * Format codebase analysis for inclusion in AI context
     */
    private formatCodebaseAnalysisForContext(
        analysis: Array<{ path: string; description: string; consumes: string[]; consumed_by: string[] }>
    ): string {
        if (analysis.length === 0) {
            return '';
        }

        const formatted: string[] = [];
        formatted.push(`## 📋 Codebase Analysis & File Relationships\n\n`);
        formatted.push(`This analysis provides context about the codebase structure to help you make informed decisions about which files to examine.\n\n`);
        formatted.push(`**Relationship Types:**\n`);
        formatted.push(`- **Consumes**: Files that this file imports/depends on\n`);
        formatted.push(`- **Consumed By**: Files that import/depend on this file\n\n`);

        // Group by directory for better organization
        const byDirectory = new Map<string, Array<{ path: string; description: string; consumes: string[]; consumed_by: string[] }>>();
        analysis.forEach(item => {
            const dir = item.path.split('/').slice(0, -1).join('/') || 'root';
            if (!byDirectory.has(dir)) {
                byDirectory.set(dir, []);
            }
            byDirectory.get(dir)!.push(item);
        });

        // Sort directories for consistent output
        const sortedDirs = Array.from(byDirectory.keys()).sort();

        for (const dir of sortedDirs) {
            const files = byDirectory.get(dir)!;
            formatted.push(`### ${dir || 'Root'}\n\n`);
            
            for (const file of files) {
                formatted.push(`- **\`${file.path}\`**: ${file.description}`);
                
                if (file.consumes && file.consumes.length > 0) {
                    formatted.push(`\n  - *Consumes*: ${file.consumes.slice(0, 5).map(r => `\`${r}\``).join(', ')}${file.consumes.length > 5 ? '...' : ''}`);
                }
                
                if (file.consumed_by && file.consumed_by.length > 0) {
                    formatted.push(`\n  - *Consumed By*: ${file.consumed_by.slice(0, 5).map(r => `\`${r}\``).join(', ')}${file.consumed_by.length > 5 ? '...' : ''}`);
                }
                
                formatted.push(`\n`);
            }
            formatted.push(`\n`);
        }

        formatted.push(`\n**Use this analysis to understand the codebase structure and identify relevant files for the task.**\n\n`);

        return formatted.join('');
    }

    private async performReasoningStep(
        param: Execution,
        question: string,
        description: string,
        codeManager: ThinkCodeManager,
        todoManager: ThinkTodoManager,
        fileIndex: Map<string, string[]>,
        analyzedFiles: Map<string, FileAnalysis>,
        currentContext: string,
        iteration: number,
        previousSteps: ThinkStep[]
    ): Promise<ThinkResponse | undefined> {
        
        const analyzedFilesList = Array.from(analyzedFiles.values());
        const analyzedFilesSummary = analyzedFilesList.length > 0
            ? `\n\nPreviously analyzed files (${analyzedFilesList.length}):\n${analyzedFilesList.map(f => `- ${f.path} (${f.relevance}): ${f.key_findings.substring(0, 150)}...`).join('\n')}`
            : '';

        const codeStats = codeManager.getStats();
        const codeStateInfo = codeManager.getContextForAI();
        const todoContext = todoManager.getContextForAI();
        const todoStats = todoManager.getStats();
        
        // Get codebase analysis from initial step (stored in currentContext at start)
        const codebaseAnalysisMatch = currentContext.match(/## 📋 Codebase Analysis & File Relationships\n\n([\s\S]*?)(?=\n##|$)/);
        const codebaseAnalysis = codebaseAnalysisMatch ? codebaseAnalysisMatch[1] : '';

        // Build summary of previous steps to avoid repetition
        const stepsSummary = previousSteps.length > 0
            ? `\n\n## Previous Steps Taken (${previousSteps.length}):\n${previousSteps.slice(-5).map(s => 
                `- Step ${s.step_number}: ${s.action} - ${s.reasoning.substring(0, 100)}...`
            ).join('\n')}${previousSteps.length > 5 ? `\n... and ${previousSteps.length - 5} more steps` : ''}`
            : '';

        const fileListSummary = `\n\nAvailable files in repository (${codeStats.totalFiles} files):\n${Array.from(codeManager.getAllFiles().keys()).slice(0, 50).join('\n')}${codeStats.totalFiles > 50 ? `\n... and ${codeStats.totalFiles - 50} more files` : ''}`;

        const prompt = `
# Code Analysis Assistant

You are an advanced code analysis assistant similar to Cursor's Auto agent. Your role is to perform deep analysis of codebases and propose thoughtful changes.

**CRITICAL CONCEPTS**:

1. **VIRTUAL CODEBASE**: You are working with a VIRTUAL CODEBASE. When you propose changes, they are automatically applied to the code in memory. Subsequent steps will see the MODIFIED code, not the original. This allows you to build upon previous changes incrementally.

2. **TODO LIST SYSTEM**: You have a TODO list system to track high-level tasks. Each task in the TODO list may require multiple reasoning steps (search, read, analyze, propose). Use this to:
   - Create TODOs in your first iteration to break down the problem
   - Update TODO status as you make progress (pending → in_progress → completed)
   - Link your actions to TODOs to show which task you're working on
   - This helps you understand where you are in the overall process, even if you need many steps per task

3. **TWO-LEVEL REASONING**: 
   - **High-level (TODO list)**: What major tasks need to be done?
   - **Low-level (reasoning steps)**: How do I accomplish each task? (search, read, analyze, propose)

${codebaseAnalysis ? `\n\n## 📋 Codebase Analysis & File Relationships\n\n${codebaseAnalysis}\n\n**This analysis helps you understand the codebase structure and relationships between files. Use it to make informed decisions about which files to examine for the task.**\n\n` : ''}

${todoStats.total > 0 ? `\n${todoContext}\n\n**CRITICAL**: To work on a TODO, use its EXACT ID (shown above) when updating. Don't just update status - DO THE ACTUAL WORK (search, read, analyze, propose) in the same response where you update the TODO.` : iteration === 1 ? `\n\n## 📋 TODO List\n\n**IMPORTANT**: In your first response, you should create a TODO list breaking down the problem into manageable tasks. Use the \`todo_updates.create\` field to create initial TODOs. Each TODO represents a high-level task that may require multiple reasoning steps to complete.` : ''}

## Current Task

${description ? `### Context/Issue Description:\n\`\`\`\n${description}\n\`\`\`` : ''}

### User's Question/Prompt:
\`\`\`
${question}
\`\`\`

## Reasoning Process (Iteration ${iteration}/${this.MAX_ITERATIONS})

${iteration === 1 ? 'You are starting your analysis. Begin by understanding the question and identifying what files or areas of the codebase might be relevant.' : `You have been analyzing this problem through ${iteration - 1} previous iterations.`}

${stepsSummary}

${codeStats.totalChanges > 0 ? `\n\n## ⚠️ CODE STATE: ${codeStats.totalChanges} changes have been applied to ${codeStats.modifiedFiles} files\n\n${codeStateInfo}\n\n**IMPORTANT**: When you read files, you will see the MODIFIED version with all previous changes applied. Build upon this modified code, don't repeat changes that have already been made.` : ''}

${analyzedFilesSummary}

${iteration > 1 ? `\n\n## Previous Iteration Context:\n${currentContext.substring(0, 4000)}${currentContext.length > 4000 ? '\n... (truncated for brevity)' : ''}` : ''}

${fileListSummary}

## Your Analysis Approach

1. **search_files**: Use when you need to find files by name, pattern, or path. Be specific. AVOID searching for the same terms repeatedly.
2. **read_file**: Use when you need to examine specific files. The files you read will show the CURRENT STATE (with all applied changes from previous steps).
3. **analyze_code**: Use when you've read files and want to document findings. Focus on understanding relationships and dependencies.
4. **propose_changes**: Use when you have enough context. **CRITICAL**: Only propose NEW changes that build upon what's already been done. Don't repeat changes that were already applied.
5. **update_todos** (or include with other actions): 
   - Create TODOs ONLY in your first iteration to break down the problem
   - Update TODO status when you START working on it (in_progress) or COMPLETE it (completed)
   - **IMPORTANT**: Use the EXACT TODO ID from the list above (e.g., "todo_1"), NOT numeric IDs
   - Include todo_updates in the SAME response where you do the actual work
6. **complete**: Use when your analysis is finished and you have a comprehensive understanding. All TODOs should be completed or cancelled.

## Critical Instructions

- **USE TODO LIST CORRECTLY**: 
  - Create TODOs in iteration 1 to break down the problem into manageable tasks
  - **IMPORTANT**: When updating TODOs, you MUST use the EXACT ID shown in the TODO list (e.g., "todo_1", "todo_2"). Do NOT use numeric IDs like "1" or "2"
  - Each TODO represents a high-level task that may require multiple reasoning steps (search, read, analyze, propose)
  
- **WORK ON TODOS, DON'T JUST UPDATE THEM**:
  - When a TODO is "pending" or "in_progress", DO REAL WORK: search for files, read files, analyze code, propose changes
  - Only update TODO status when you actually START working on it (mark "in_progress") or COMPLETE it (mark "completed")
  - Don't waste iterations just updating TODO status - do the actual work!
  
- **TRACK PROGRESS**: 
  - When you START working on a TODO: mark it "in_progress" AND then do the work (search, read, analyze, propose)
  - When you COMPLETE work on a TODO: mark it "completed" 
  - Update TODOs in the same response where you do the work, don't create separate "update_todos" actions

- **AVOID REPETITION**: Don't search for the same files repeatedly. Don't propose changes that have already been applied. Don't try to update TODOs with wrong IDs.

- **BUILD INCREMENTALLY**: Each step should build upon the previous one. Read files that were modified in previous steps to see the current state.

- **PROGRESS FORWARD**: If you've already analyzed files, move to proposing changes. Don't re-analyze the same code.

- **SEE THE MODIFIED CODE**: When you read files after changes have been applied, you'll see the modified version. Use this to understand the current state and propose the NEXT logical step.

- **BE SPECIFIC**: When proposing changes, be very specific about what needs to change and provide suggested_code.

- **THINK DEEPLY**: Don't just propose generic changes. Analyze the code structure, dependencies, and relationships before proposing changes.

- **FOCUS ON ACTIVE TODOS**: Work on TODOs that are "pending" or "in_progress". Complete them by doing real work, not just updating status.

## Important

- You must return a valid JSON object matching the schema
- Be thorough but efficient - don't request files you don't need
- Build understanding incrementally
- Connect insights across multiple files when relevant
- Each iteration should advance the analysis, not repeat previous steps
- You can include \`todo_updates\` alongside any action (not just when action is 'update_todos')
- When creating TODOs, make them specific and actionable (e.g., "Analyze authentication system" not "Do stuff")
`;

        try {
            const response = await this.aiRepository.askThinkJson(param.ai, prompt);
            return response as ThinkResponse;
        } catch (error) {
            logError(`Error in reasoning step: ${error}`);
            return undefined;
        }
    }

    private async generateFinalAnalysis(
        param: Execution,
        question: string,
        analyzedFiles: Map<string, FileAnalysis>,
        proposedChanges: ProposedChange[],
        steps: ThinkStep[],
        todoManager: ThinkTodoManager
    ): Promise<string> {
        
        const prompt = `
# Final Analysis Summary

Based on your analysis of the codebase, provide a comprehensive summary and recommendations.

## User's Question:
${question}

## Analysis Summary:
- Total steps taken: ${steps.length}
- Files analyzed: ${analyzedFiles.size}
- Proposed changes: ${proposedChanges.length}
- TODO list: ${todoManager.getSummary()}

## Analyzed Files:
${Array.from(analyzedFiles.values()).map(f => `- ${f.path} (${f.relevance}): ${f.key_findings}`).join('\n')}

## Proposed Changes:
${proposedChanges.map(c => `
### ${c.change_type.toUpperCase()}: ${c.file_path}
**Description:** ${c.description}
**Reasoning:** ${c.reasoning}
${c.suggested_code ? `**Suggested Code:**\n\`\`\`\n${c.suggested_code}\n\`\`\`` : ''}
`).join('\n')}

## Steps Taken:
${steps.map(s => `${s.step_number}. ${s.action}: ${s.reasoning.substring(0, 150)}...`).join('\n')}

Provide a comprehensive final analysis that:
1. Summarizes what you discovered
2. Explains the key insights
3. Provides clear recommendations
4. Describes the proposed changes and their rationale
5. Notes any considerations or potential issues

Be thorough, clear, and actionable.
`;

        const response = await this.aiRepository.ask(param.ai, prompt);
        return response || 'Analysis completed. Review the proposed changes and steps above.';
    }

    private formatReasoningComment(
        question: string,
        description: string,
        steps: ThinkStep[],
        analyzedFiles: Map<string, FileAnalysis>,
        proposedChanges: ProposedChange[],
        finalAnalysis: string,
        totalIterations: number,
        todoManager: ThinkTodoManager
    ): string {
        const GITHUB_COMMENT_MAX_LENGTH = 65500; // Leave some margin below 65536
        let comment = '';

        // Header
        comment += `# 🤔 AI Reasoning Analysis\n\n`;
        
        if (question) {
            comment += `## 📝 Question\n\n${question}\n\n`;
        }

        comment += `---\n\n`;

        // MAIN CONTENT: Summary and conclusions
        comment += `## 📊 Analysis Summary\n\n`;
        comment += `- **Total Iterations**: ${totalIterations}\n`;
        comment += `- **Files Analyzed**: ${analyzedFiles.size}\n`;
        comment += `- **Changes Proposed**: ${proposedChanges.length}\n`;
        
        // TODO List Summary
        const todoStats = todoManager.getStats();
        if (todoStats.total > 0) {
            comment += `- **TODO Tasks**: ${todoStats.total} (${todoStats.completed} completed, ${todoStats.in_progress} in progress, ${todoStats.pending} pending)\n`;
        }
        
        comment += `\n---\n\n`;

        // Final Analysis & Conclusions (main content)
        if (finalAnalysis) {
            comment += `## 🎯 Final Analysis & Conclusions\n\n`;
            comment += `${finalAnalysis}\n\n`;
            comment += `---\n\n`;
        } else {
            // Fallback summary if no final analysis
            comment += `## 🎯 Summary\n\n`;
            comment += `Analysis completed after ${totalIterations} iterations. `;
            comment += `Analyzed ${analyzedFiles.size} file${analyzedFiles.size !== 1 ? 's' : ''} and `;
            comment += `proposed ${proposedChanges.length} change${proposedChanges.length !== 1 ? 's' : ''}.\n\n`;
            comment += `---\n\n`;
        }

        // Proposed Changes (main content)
        if (proposedChanges.length > 0) {
            comment += `## 💡 Proposed Changes\n\n`;
            proposedChanges.forEach((change, idx) => {
                comment += this.formatProposedChange(change, idx + 1);
            });
            comment += `\n---\n\n`;
        } else {
            comment += `## 💡 Proposed Changes\n\n`;
            comment += `No specific code changes were proposed. The analysis focused on understanding the codebase structure and requirements.\n\n`;
            comment += `---\n\n`;
        }

        // Analyzed Files Summary (if relevant)
        if (analyzedFiles.size > 0 && analyzedFiles.size <= 10) {
            comment += `## 📄 Analyzed Files\n\n`;
            Array.from(analyzedFiles.values()).forEach(file => {
                comment += `- **\`${file.path}\`** (${file.relevance} relevance): ${file.key_findings.substring(0, 200)}${file.key_findings.length > 200 ? '...' : ''}\n`;
            });
            comment += `\n---\n\n`;
        }

        // TODO List Summary (if relevant)
        if (todoStats.total > 0) {
            comment += `## 📋 TODO List Summary\n\n`;
            const completedTodos = todoManager.getTodosByStatus('completed');
            const activeTodos = todoManager.getActiveTodos();
            
            if (completedTodos.length > 0) {
                comment += `### ✅ Completed Tasks\n\n`;
                completedTodos.forEach(todo => {
                    comment += `- ${todo.content}\n`;
                });
                comment += `\n`;
            }
            
            if (activeTodos.length > 0) {
                comment += `### 🔄 Active/Pending Tasks\n\n`;
                activeTodos.forEach(todo => {
                    comment += `- ${todo.status === 'in_progress' ? '🔄' : '⏳'} ${todo.content}\n`;
                });
                comment += `\n`;
            }
            
            comment += `---\n\n`;
        }

        // COLLAPSED SECTION: Detailed Reasoning Steps
        comment += `<details>\n<summary><strong>🔄 Detailed Reasoning Steps (${steps.length} steps) - Click to expand</strong></summary>\n\n`;
        comment += `\n\n*This section contains the detailed step-by-step reasoning process. It's collapsed by default to keep the main analysis focused.*\n\n`;
        comment += `---\n\n`;

        let proposalIndex = 0;
        const proposalShownFlags = new Set<number>();

        for (const step of steps) {
            comment += `### Step ${step.step_number}: ${this.getActionEmoji(step.action)} ${this.formatActionName(step.action)}\n\n`;
            
            // Show reasoning (truncated for collapsed section)
            if (step.reasoning) {
                const reasoningText = step.reasoning.length > 500 
                    ? `${step.reasoning.substring(0, 500)}...` 
                    : step.reasoning;
                comment += `${reasoningText}\n\n`;
            }

            // Show files involved (simplified)
            if (step.files_involved && step.files_involved.length > 0) {
                const uniqueFiles = [...new Set(step.files_involved)];
                comment += `**Files**: ${uniqueFiles.map(f => `\`${f}\``).join(', ')}\n\n`;
            }

            // Show file analysis (simplified)
            if (step.action === 'analyze_code' || step.action === 'read_file') {
                const relevantFiles = Array.from(analyzedFiles.values()).filter(f => 
                    step.files_involved?.includes(f.path)
                );
                
                const stepAnalysis = (step as any).file_analysis_in_step as FileAnalysis[] | undefined;
                const filesToShow = stepAnalysis || relevantFiles;
                
                if (filesToShow.length > 0) {
                    comment += `**Analysis**: `;
                    filesToShow.forEach((file, idx) => {
                        if (idx > 0) comment += ` | `;
                        comment += `\`${file.path}\` (${file.relevance}): ${file.key_findings.substring(0, 100)}${file.key_findings.length > 100 ? '...' : ''}`;
                    });
                    comment += `\n\n`;
                }
            }

            // Show proposals (simplified reference)
            const stepProposals = (step as any).proposals_in_step as ProposedChange[] | undefined;
            if (stepProposals && stepProposals.length > 0) {
                comment += `**Proposed Changes**: ${stepProposals.map(c => `${c.change_type} \`${c.file_path}\``).join(', ')}\n\n`;
                
                // Mark as shown
                stepProposals.forEach((change) => {
                    const globalIndex = proposedChanges.indexOf(change);
                    if (globalIndex >= 0) {
                        proposalShownFlags.add(globalIndex);
                    }
                });
            }

            comment += `---\n\n`;
        }

        comment += `\n</details>\n\n`;
        comment += `---\n\n`;

        // Footer
        comment += `*Analysis completed in ${totalIterations} iterations. Analyzed ${analyzedFiles.size} files and proposed ${proposedChanges.length} changes.*\n`;

        // Truncate if too long
        if (comment.length > GITHUB_COMMENT_MAX_LENGTH) {
            // Try to keep main content, truncate collapsed section
            const mainContent = comment.substring(0, comment.indexOf('<details>'));
            const truncated = mainContent + `\n\n<details>\n<summary><strong>🔄 Detailed Reasoning Steps - Truncated due to length</strong></summary>\n\n*Steps section was truncated due to comment length limits.*\n\n</details>\n\n`;
            if (truncated.length > GITHUB_COMMENT_MAX_LENGTH) {
                // If still too long, truncate main content
                const finalTruncated = truncated.substring(0, GITHUB_COMMENT_MAX_LENGTH - 200);
                return finalTruncated + `\n\n*[Comment truncated due to length limit]*\n`;
            }
            return truncated;
        }

        return comment;
    }

    private getActionEmoji(action: string): string {
        const emojiMap: { [key: string]: string } = {
            'search_files': '🔍',
            'read_file': '📖',
            'analyze_code': '🔬',
            'propose_changes': '💡',
            'complete': '✅'
        };
        return emojiMap[action] || '📝';
    }

    private formatActionName(action: string): string {
        const nameMap: { [key: string]: string } = {
            'search_files': 'Search Files',
            'read_file': 'Read Files',
            'analyze_code': 'Analyze Code',
            'propose_changes': 'Propose Changes',
            'complete': 'Complete'
        };
        return nameMap[action] || action;
    }

    private formatProposedChange(change: ProposedChange, index: number): string {
        let formatted = `### ${index}. ${this.getChangeTypeEmoji(change.change_type)} ${change.change_type.toUpperCase()}: \`${change.file_path}\`\n\n`;
        
        formatted += `**Description**: ${change.description}\n\n`;
        
        if (change.reasoning) {
            formatted += `**Reasoning**: ${change.reasoning}\n\n`;
        }

        if (change.suggested_code) {
            const language = this.detectLanguageFromPath(change.file_path);
            formatted += `**Suggested Code**:\n\n`;
            formatted += `\`\`\`${language}\n${change.suggested_code}\n\`\`\`\n\n`;
        }

        formatted += `---\n\n`;
        
        return formatted;
    }

    /**
     * Detect programming language from file path/extension
     */
    private detectLanguageFromPath(filePath: string): string {
        const extension = filePath.split('.').pop()?.toLowerCase() || '';
        
        const languageMap: { [key: string]: string } = {
            // TypeScript/JavaScript
            'ts': 'typescript',
            'tsx': 'tsx',
            'js': 'javascript',
            'jsx': 'jsx',
            'mjs': 'javascript',
            'cjs': 'javascript',
            
            // Python
            'py': 'python',
            'pyw': 'python',
            'pyi': 'python',
            
            // Java/Kotlin
            'java': 'java',
            'kt': 'kotlin',
            'kts': 'kotlin',
            
            // Go
            'go': 'go',
            
            // Rust
            'rs': 'rust',
            
            // C/C++
            'c': 'c',
            'cpp': 'cpp',
            'cc': 'cpp',
            'cxx': 'cpp',
            'h': 'c',
            'hpp': 'cpp',
            'hxx': 'cpp',
            
            // C#
            'cs': 'csharp',
            
            // Ruby
            'rb': 'ruby',
            
            // PHP
            'php': 'php',
            
            // Swift
            'swift': 'swift',
            
            // Dart
            'dart': 'dart',
            
            // Shell
            'sh': 'bash',
            'bash': 'bash',
            'zsh': 'bash',
            'fish': 'fish',
            
            // Configuration
            'json': 'json',
            'yaml': 'yaml',
            'yml': 'yaml',
            'toml': 'toml',
            'xml': 'xml',
            'ini': 'ini',
            'conf': 'conf',
            'config': 'conf',
            
            // Markup
            'html': 'html',
            'htm': 'html',
            'css': 'css',
            'scss': 'scss',
            'sass': 'sass',
            'less': 'less',
            'md': 'markdown',
            'markdown': 'markdown',
            
            // SQL
            'sql': 'sql',
            
            // Docker
            'dockerfile': 'dockerfile',
            'docker': 'dockerfile',
            
            // Other
            'txt': 'text',
            'log': 'text',
        };
        
        // Check for exact match
        if (languageMap[extension]) {
            return languageMap[extension];
        }
        
        // Check for Dockerfile (no extension)
        if (filePath.toLowerCase().includes('dockerfile')) {
            return 'dockerfile';
        }
        
        // Default to empty string if unknown
        return '';
    }

    private getChangeTypeEmoji(changeType: string): string {
        const emojiMap: { [key: string]: string } = {
            'create': '✨',
            'modify': '📝',
            'delete': '🗑️',
            'refactor': '♻️'
        };
        return emojiMap[changeType] || '📝';
    }
}

