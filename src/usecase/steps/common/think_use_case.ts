import { ThinkResponse, ThinkStep, ProposedChange, FileAnalysis } from '../../../data/model/think_response';
import { Execution } from '../../../data/model/execution';
import { Result } from '../../../data/model/result';
import { AiRepository } from '../../../data/repository/ai_repository';
import { FileRepository } from '../../../data/repository/file_repository';
import { IssueRepository } from '../../../data/repository/issue_repository';
import { logDebugInfo, logError, logInfo } from '../../../utils/logger';
import { ParamUseCase } from '../../base/param_usecase';

export class ThinkUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'ThinkUseCase';
    private aiRepository: AiRepository = new AiRepository();
    private fileRepository: FileRepository = new FileRepository();
    private issueRepository: IssueRepository = new IssueRepository();
    
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

            // Build file index for quick lookup
            const fileIndex = this.buildFileIndex(repositoryFiles);
            
            // Reasoning process
            const steps: ThinkStep[] = [];
            let iteration = 0;
            let complete = false;
            let analyzedFiles: Map<string, FileAnalysis> = new Map();
            let allProposedChanges: ProposedChange[] = [];
            let currentContext = '';
            let finalAnalysis = '';
            let consecutiveSearches = 0; // Track consecutive search_files without reading
            let lastProgressIteration = 0; // Track last iteration with actual progress
            let filesReadInIteration = 0;

            while (!complete && iteration < this.MAX_ITERATIONS) {
                iteration++;
                filesReadInIteration = 0;
                logInfo(`🤔 Reasoning iteration ${iteration}/${this.MAX_ITERATIONS}`);

                const thinkResponse = await this.performReasoningStep(
                    param,
                    question,
                    description,
                    repositoryFiles,
                    fileIndex,
                    analyzedFiles,
                    currentContext,
                    iteration
                ) as ThinkResponse;

                if (!thinkResponse) {
                    logError('No response from AI reasoning step');
                    break;
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

                // Execute action
                switch (thinkResponse.action) {
                    case 'search_files':
                        consecutiveSearches++;
                        if (thinkResponse.files_to_search && thinkResponse.files_to_search.length > 0) {
                            const foundFiles = this.searchFiles(thinkResponse.files_to_search, fileIndex);
                            logInfo(`🔍 Search results: Found ${foundFiles.length} files for terms: ${thinkResponse.files_to_search.join(', ')}`);
                            if (foundFiles.length > 0) {
                                currentContext += `\n\nFound ${foundFiles.length} files matching search criteria:\n${foundFiles.map(f => `- ${f}`).join('\n')}`;
                                
                                // If found files after multiple searches, suggest reading them
                                if (consecutiveSearches >= this.MAX_CONSECUTIVE_SEARCHES && foundFiles.length > 0) {
                                    currentContext += `\n\n💡 Tip: You've searched ${consecutiveSearches} times. Consider reading some of the found files to proceed with analysis: ${foundFiles.slice(0, 5).join(', ')}`;
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

                                const content = repositoryFiles.get(filePath);
                                if (content !== undefined) {
                                    filesReadInIteration++;
                                    logDebugInfo(`✅ Reading file: ${filePath} (${content.length} chars)`);
                                    currentContext += `\n\n=== File: ${filePath} ===\n${content.substring(0, 8000)}${content.length > 8000 ? '\n... (truncated)' : ''}`;
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
                            // Store the index where these proposals start for proper ordering
                            const startIndex = allProposedChanges.length;
                            allProposedChanges.push(...thinkResponse.proposed_changes);
                            
                            // Attach to step with start index for proper display order
                            const currentStep = steps[steps.length - 1];
                            if (currentStep) {
                                (currentStep as any).proposals_in_step = thinkResponse.proposed_changes;
                                (currentStep as any).proposals_start_index = startIndex;
                            }
                            
                            const changesSummary = thinkResponse.proposed_changes
                                .map(c => `${c.change_type} ${c.file_path}: ${c.description}`)
                                .join('\n');
                            currentContext += `\n\nProposed changes:\n${changesSummary}`;
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
                finalAnalysis = await this.generateFinalAnalysis(param, question, analyzedFiles, allProposedChanges, steps);
            }

            // Format and post comprehensive reasoning comment
            const formattedComment = this.formatReasoningComment(
                question,
                description,
                steps,
                analyzedFiles,
                allProposedChanges,
                finalAnalysis,
                iteration
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

    private async performReasoningStep(
        param: Execution,
        question: string,
        description: string,
        repositoryFiles: Map<string, string>,
        fileIndex: Map<string, string[]>,
        analyzedFiles: Map<string, FileAnalysis>,
        currentContext: string,
        iteration: number
    ): Promise<ThinkResponse | undefined> {
        
        const analyzedFilesList = Array.from(analyzedFiles.values());
        const analyzedFilesSummary = analyzedFilesList.length > 0
            ? `\n\nPreviously analyzed files:\n${analyzedFilesList.map(f => `- ${f.path} (${f.relevance}): ${f.key_findings}`).join('\n')}`
            : '';

        const fileListSummary = `\n\nAvailable files in repository (${repositoryFiles.size} files):\n${Array.from(repositoryFiles.keys()).slice(0, 50).join('\n')}${repositoryFiles.size > 50 ? `\n... and ${repositoryFiles.size - 50} more files` : ''}`;

        const prompt = `
# Code Analysis Assistant

You are an advanced code analysis assistant similar to Cursor's Auto agent. Your role is to perform deep analysis of codebases and propose thoughtful changes.

## Current Task

${description ? `### Context/Issue Description:\n\`\`\`\n${description}\n\`\`\`` : ''}

### User's Question/Prompt:
\`\`\`
${question}
\`\`\`

## Reasoning Process (Iteration ${iteration})

${iteration === 1 ? 'You are starting your analysis. Begin by understanding the question and identifying what files or areas of the codebase might be relevant.' : `You have been analyzing this problem. Previous context:\n${currentContext.substring(0, 3000)}${currentContext.length > 3000 ? '\n... (truncated for brevity)' : ''}`}

${analyzedFilesSummary}

${fileListSummary}

## Your Analysis Approach

1. **search_files**: Use when you need to find files by name, pattern, or path. Be specific about what you're looking for.
2. **read_file**: Use when you need to examine specific files in detail to understand their implementation.
3. **analyze_code**: Use when you've read files and want to document your findings about them.
4. **propose_changes**: Use when you have enough context to suggest specific code changes.
5. **complete**: Use when your analysis is finished and you have a comprehensive understanding.

## Instructions

- Think step by step about what you need to understand
- When searching, use specific file names, directory names, or patterns
- When analyzing, focus on understanding relationships, dependencies, and how code works
- When proposing changes, be specific about what needs to change and why
- Always provide clear reasoning for each step
- Consider the full context of the codebase, not just individual files
- Think about edge cases, dependencies, and potential impacts

## Important

- You must return a valid JSON object matching the schema
- Be thorough but efficient - don't request files you don't need
- Build understanding incrementally
- Connect insights across multiple files when relevant
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
        steps: ThinkStep[]
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
        totalIterations: number
    ): string {
        const GITHUB_COMMENT_MAX_LENGTH = 65500; // Leave some margin below 65536
        let comment = '';

        // Header
        comment += `# 🤔 AI Reasoning Analysis\n\n`;
        
        if (question) {
            comment += `## 📝 Question\n\n${question}\n\n`;
        }

        if (description && description !== question) {
            comment += `## 📋 Context\n\n${description.substring(0, 1000)}${description.length > 1000 ? '...' : ''}\n\n`;
        }

        comment += `---\n\n`;

        // Summary
        comment += `## 📊 Analysis Summary\n\n`;
        comment += `- **Total Iterations**: ${totalIterations}\n`;
        comment += `- **Files Analyzed**: ${analyzedFiles.size}\n`;
        comment += `- **Changes Proposed**: ${proposedChanges.length}\n\n`;

        comment += `---\n\n`;

        // Steps with interleaved proposals - similar to chat format
        comment += `## 🔄 Reasoning Steps\n\n`;

        let proposalIndex = 0;
        const proposalShownFlags = new Set<number>();

        for (const step of steps) {
            comment += `### Step ${step.step_number}: ${this.getActionEmoji(step.action)} ${this.formatActionName(step.action)}\n\n`;
            
            // Show reasoning
            if (step.reasoning) {
                comment += `${step.reasoning}\n\n`;
            }

            // Show files involved
            if (step.files_involved && step.files_involved.length > 0) {
                const uniqueFiles = [...new Set(step.files_involved)];
                comment += `**Files involved**:\n`;
                uniqueFiles.forEach(file => {
                    comment += `- \`${file}\`\n`;
                });
                comment += `\n`;
            }

            // Show file analysis for files read/analyzed in this step
            if (step.action === 'analyze_code' || step.action === 'read_file') {
                const relevantFiles = Array.from(analyzedFiles.values()).filter(f => 
                    step.files_involved?.includes(f.path)
                );
                
                // Also check if step has direct analysis data
                const stepAnalysis = (step as any).file_analysis_in_step as FileAnalysis[] | undefined;
                const filesToShow = stepAnalysis || relevantFiles;
                
                if (filesToShow.length > 0) {
                    comment += `#### 📄 Analysis of Files\n\n`;
                    filesToShow.forEach(file => {
                        comment += `**\`${file.path}\`** (${file.relevance} relevance):\n`;
                        comment += `${file.key_findings}\n\n`;
                    });
                }
            }

            // Show proposals if this step generated them (interleaved with steps)
            const stepProposals = (step as any).proposals_in_step as ProposedChange[] | undefined;
            const proposalsStartIndex = (step as any).proposals_start_index as number | undefined;
            
            if (stepProposals && stepProposals.length > 0) {
                comment += `#### 💡 Proposed Changes from this Step\n\n`;
                stepProposals.forEach((change) => {
                    // Use the start index if available, otherwise find in array
                    let globalIndex = proposalsStartIndex !== undefined 
                        ? proposalsStartIndex + stepProposals.indexOf(change)
                        : proposedChanges.indexOf(change);
                    
                    if (globalIndex >= 0 && globalIndex < proposedChanges.length && !proposalShownFlags.has(globalIndex)) {
                        proposalShownFlags.add(globalIndex);
                        proposalIndex++;
                        comment += this.formatProposedChange(change, proposalIndex);
                    }
                });
            }

            comment += `\n---\n\n`;
        }

        // Show any remaining proposals that weren't attached to specific steps
        const remainingProposals = proposedChanges.filter((_, idx) => !proposalShownFlags.has(idx));
        if (remainingProposals.length > 0) {
            comment += `## 💡 Additional Proposed Changes\n\n`;
            remainingProposals.forEach((change) => {
                proposalIndex++;
                comment += this.formatProposedChange(change, proposalIndex);
            });
            comment += `\n---\n\n`;
        }

        // Final Analysis
        if (finalAnalysis) {
            comment += `## 🎯 Final Analysis & Recommendations\n\n`;
            comment += `${finalAnalysis}\n\n`;
            comment += `---\n\n`;
        }

        // Footer
        comment += `---\n\n`;
        comment += `*Analysis completed in ${totalIterations} iterations. Analyzed ${analyzedFiles.size} files and proposed ${proposedChanges.length} changes.*\n`;

        // Truncate if too long
        if (comment.length > GITHUB_COMMENT_MAX_LENGTH) {
            const truncated = comment.substring(0, GITHUB_COMMENT_MAX_LENGTH - 200);
            comment = truncated + `\n\n*[Comment truncated due to length limit]*\n`;
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
            formatted += `**Suggested Code**:\n\n`;
            formatted += `\`\`\`\n${change.suggested_code}\n\`\`\`\n\n`;
        }

        formatted += `---\n\n`;
        
        return formatted;
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

