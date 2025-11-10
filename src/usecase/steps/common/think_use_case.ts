import { ThinkResponse, ThinkStep, ProposedChange, FileAnalysis } from '../../../data/model/think_response';
import { Execution } from '../../../data/model/execution';
import { Result } from '../../../data/model/result';
import { AiRepository } from '../../../data/repository/ai_repository';
import { FileRepository } from '../../../data/repository/file_repository';
import { IssueRepository } from '../../../data/repository/issue_repository';
import { logDebugInfo, logError, logInfo } from '../../../utils/logger';
import { ParamUseCase } from '../../base/param_usecase';
import { ThinkCodeManager } from './think_code_manager';
import { ThinkTodoManager } from './think_todo_manager';
import { FileImportAnalyzer } from './services/file_import_analyzer';
import { FileCacheManager } from './services/file_cache_manager';
import { CodebaseAnalyzer } from './services/codebase_analyzer';
import { FileSearchService } from './services/file_search_service';
import { CommentFormatter } from './services/comment_formatter';

export class ThinkUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'ThinkUseCase';
    private aiRepository: AiRepository = new AiRepository();
    private fileRepository: FileRepository = new FileRepository();
    private issueRepository: IssueRepository = new IssueRepository();
    
    // Services
    private fileImportAnalyzer: FileImportAnalyzer = new FileImportAnalyzer();
    private fileCacheManager: FileCacheManager = new FileCacheManager();
    private codebaseAnalyzer: CodebaseAnalyzer;
    private fileSearchService: FileSearchService = new FileSearchService();
    private commentFormatter: CommentFormatter = new CommentFormatter();
    
    private readonly MAX_ITERATIONS = 30; // Increased to allow deeper analysis
    private readonly MAX_FILES_TO_ANALYZE = 50; // Increased file limit
    private readonly MAX_CONSECUTIVE_SEARCHES = 3; // Max consecutive search_files without progress
    private readonly MAX_FILES_PER_READ = 3; // Maximum files to read per iteration
    
    constructor() {
        // Initialize CodebaseAnalyzer with dependencies
        this.codebaseAnalyzer = new CodebaseAnalyzer(
            this.aiRepository,
            this.fileImportAnalyzer,
            this.fileCacheManager
        );
    }
    
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
            // AI will create initial TODOs in first iteration if needed

            // Build file index for quick lookup
            const fileIndex = this.fileSearchService.buildFileIndex(repositoryFiles);
            
            // STEP 0: Generate codebase analysis and file relationships (for internal use only, not sent to AI)
            logInfo(`🔍 Step 0: Analyzing codebase structure and file relationships...`);
            const codebaseAnalysis = await this.codebaseAnalyzer.generateCodebaseAnalysis(
                param,
                repositoryFiles,
                question
            );
            logInfo(`✅ Codebase analysis completed. Analyzed ${codebaseAnalysis.length} files.`);
            
            // Create a map of file paths to their analysis descriptions for quick lookup (internal use)
            const fileAnalysisMap = new Map<string, { description: string; consumes: string[]; consumed_by: string[] }>();
            codebaseAnalysis.forEach(item => {
                fileAnalysisMap.set(item.path, {
                    description: item.description,
                    consumes: item.consumes,
                    consumed_by: item.consumed_by
                });
            });
            
            // Reasoning process with conversational message history
            const steps: ThinkStep[] = [];
            const conversationMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
            let iteration = 0;
            let complete = false;
            let analyzedFiles: Map<string, FileAnalysis> = new Map();
            let readFiles: Set<string> = new Set(); // Track files that have been read
            let allProposedChanges: ProposedChange[] = [];
            let finalAnalysis = '';
            let consecutiveSearches = 0; // Track consecutive search_files without reading
            let lastProgressIteration = 0; // Track last iteration with actual progress
            let filesReadInIteration = 0;
            let seenActions: Map<string, number> = new Map(); // Track action patterns to detect repetition

            while (!complete && iteration < this.MAX_ITERATIONS) {
                iteration++;
                filesReadInIteration = 0;
                // logInfo(`🤔 Reasoning iteration ${iteration}/${this.MAX_ITERATIONS}`);

                const thinkResponse = await this.performReasoningStep(
                    param,
                    question,
                    description,
                    codeManager,
                    todoManager,
                    fileIndex,
                    analyzedFiles,
                    readFiles,
                    fileAnalysisMap,
                    iteration,
                    steps,
                    conversationMessages
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
                        if (thinkResponse.todo_updates.create.length > 0) {
                            logInfo(`📋 Created ${thinkResponse.todo_updates.create.length} new TODO items`);
                        }
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
                            // logInfo(`📋 Successfully updated ${successCount} TODO items`);
                        }
                        
                        if (failedIds.length > 0) {
                            // Show available TODO IDs to help the AI
                            const allTodos = todoManager.getAllTodos();
                            const availableIds = allTodos.map(t => t.id).join(', ');
                            logInfo(`⚠️ Failed to update ${failedIds.length} TODO items. Available IDs: ${availableIds}`);
                            // Add error to conversation for next iteration
                            conversationMessages.push({
                                role: 'user',
                                content: `⚠️ TODO Update Error: Could not find TODO(s) with ID(s): ${failedIds.join(', ')}. Available TODO IDs are: ${availableIds}. Please use the EXACT ID from the TODO list.`
                            });
                        }
                    }
                }

                // Add assistant response to conversation history
                conversationMessages.push({
                    role: 'assistant',
                    content: JSON.stringify(thinkResponse, null, 2)
                });

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
                
                // Execute action and build user message with results
                let actionResults: string[] = [];
                
                switch (thinkResponse.action) {
                    case 'search_files':
                        consecutiveSearches++;
                        if (thinkResponse.files_to_search && thinkResponse.files_to_search.length > 0) {
                            // Check for generic search terms
                            const genericTerms = this.detectGenericSearchTerms(thinkResponse.files_to_search);
                            if (genericTerms.length > 0) {
                                actionResults.push(`⚠️ **WARNING**: You used generic search terms: ${genericTerms.join(', ')}. These terms are too common and will match many files. Use more specific terms like function names, class names, or specific file names.`);
                            }
                            
                            // Get current repository files (including modified files from code manager)
                            const currentFiles = codeManager.getAllFiles();
                            const foundFiles = this.fileSearchService.searchFiles(thinkResponse.files_to_search, fileIndex, currentFiles);
                            logInfo(`🔍 Search results: Found ${foundFiles.length} files for terms: ${thinkResponse.files_to_search.join(', ')}`);
                            
                            // Warn if too many files found (likely due to generic terms)
                            if (foundFiles.length > 20) {
                                actionResults.push(`⚠️ **WARNING**: Your search found ${foundFiles.length} files, which is too many. This likely means your search terms are too generic. Use more specific terms to narrow down the results.`);
                            }
                            
                            // Detect if we're repeating the same search
                            if (actionCount > 1) {
                                actionResults.push(`⚠️ WARNING: You've already searched for "${thinkResponse.files_to_search.join(', ')}" ${actionCount} times. ${foundFiles.length > 0 ? 'These files were found previously. Consider READING them instead of searching again.' : 'No files found. Consider trying different search terms.'}`);
                            }
                            
                            if (foundFiles.length > 0) {
                                actionResults.push(`Found ${foundFiles.length} files matching search criteria:\n${foundFiles.map(f => `- ${f}`).join('\n')}`);
                                
                                // If found files after multiple searches, suggest reading them
                                if (consecutiveSearches >= this.MAX_CONSECUTIVE_SEARCHES && foundFiles.length > 0) {
                                    actionResults.push(`💡 IMPORTANT: You've searched ${consecutiveSearches} times. You MUST read some of the found files now to proceed with analysis. Suggested files: ${foundFiles.slice(0, 5).join(', ')}`);
                                }
                            } else {
                                actionResults.push(`No files found matching search criteria: ${thinkResponse.files_to_search.join(', ')}. Available files in repository: ${Array.from(repositoryFiles.keys()).slice(0, 30).join(', ')}...`);
                                
                                // If too many searches without finding files, provide full file list
                                if (consecutiveSearches >= this.MAX_CONSECUTIVE_SEARCHES) {
                                    actionResults.push(`📋 Here are all available files in the repository to help you:\n${Array.from(repositoryFiles.keys()).map((f, i) => `${i + 1}. ${f}`).slice(0, 100).join('\n')}${repositoryFiles.size > 100 ? '\n... and more' : ''}`);
                                }
                            }
                        }
                        break;

                    case 'read_file':
                        consecutiveSearches = 0; // Reset counter when reading files
                        if (thinkResponse.files_to_read && thinkResponse.files_to_read.length > 0) {
                            // Limit to MAX_FILES_PER_READ files per iteration
                            const filesToAnalyze = thinkResponse.files_to_read.slice(0, this.MAX_FILES_PER_READ);
                            if (thinkResponse.files_to_read.length > this.MAX_FILES_PER_READ) {
                                logInfo(`⚠️ Requested ${thinkResponse.files_to_read.length} files, limiting to ${this.MAX_FILES_PER_READ} per iteration`);
                                actionResults.push(`⚠️ You requested ${thinkResponse.files_to_read.length} files, but only ${this.MAX_FILES_PER_READ} files can be read per iteration. Reading the first ${this.MAX_FILES_PER_READ} files now.`);
                            }
                            logInfo(`📖 Reading ${filesToAnalyze.length} files: ${filesToAnalyze.join(', ')}`);
                            
                            const newlyReadFiles: string[] = [];
                            const alreadyReadFiles: string[] = [];
                            
                            for (const filePath of filesToAnalyze) {
                                // Check if file was already read
                                if (readFiles.has(filePath)) {
                                    alreadyReadFiles.push(filePath);
                                    logDebugInfo(`⏭️ Skipping already read file: ${filePath}`);
                                    continue;
                                }
                                
                                if (analyzedFiles.has(filePath)) {
                                    logDebugInfo(`⏭️ Skipping already analyzed file: ${filePath}`);
                                    continue; // Already analyzed
                                }

                                // Get content from virtual files (includes applied changes)
                                const content = codeManager.getFileContent(filePath);
                                if (content !== undefined) {
                                    readFiles.add(filePath); // Mark as read
                                    newlyReadFiles.push(filePath);
                                    filesReadInIteration++;
                                    const isModified = codeManager.isFileModified(filePath);
                                    const modificationNote = isModified ? ` [MODIFIED - ${codeManager.getFileChanges(filePath).length} change(s) applied]` : '';
                                    logDebugInfo(`✅ Reading file: ${filePath} (${content.length} chars)${modificationNote}`);
                                    
                                    // Show current state with applied changes
                                    actionResults.push(`=== File: ${filePath}${modificationNote} ===\n${content.substring(0, 8000)}${content.length > 8000 ? '\n... (truncated)' : ''}`);
                                    
                                    // If file was modified, show what changed
                                    if (isModified) {
                                        const changes = codeManager.getFileChanges(filePath);
                                        actionResults.push(`⚠️ This file has been modified in previous steps. Changes applied: ${changes.map(c => `${c.change_type}: ${c.description}`).join(', ')}`);
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
                                    actionResults.push(`⚠️ File not found: ${filePath}. ${similarFiles.length > 0 ? `Similar files found: ${similarFiles.join(', ')}` : 'Please check the file path.'}`);
                                }
                            }
                            
                            // Warn if trying to read already read files
                            if (alreadyReadFiles.length > 0) {
                                actionResults.push(`⚠️ **WARNING**: You tried to read ${alreadyReadFiles.length} file(s) that were already read: ${alreadyReadFiles.join(', ')}. These files are already in your context. Instead, ANALYZE them or PROPOSE CHANGES based on what you've already read.`);
                            }
                            
                            if (newlyReadFiles.length === 0 && alreadyReadFiles.length > 0) {
                                // All files were already read - this is a loop
                                actionResults.push(`⚠️ **STOP READING THE SAME FILES**: You've already read all the files you requested. Move forward with analysis or proposing changes instead of re-reading.`);
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
                            actionResults.push(`Analysis findings:\n${findings}`);
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
                                actionResults.push(`⚠️ All proposed changes in this step have already been applied in previous iterations. Please propose NEW changes or move to the next step.`);
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
                            actionResults.push(`✅ Applied ${appliedCount} new changes to codebase:\n${changesSummary}`);
                            
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
                            actionResults.push(`📋 TODO list updated. Current status:\n${todoManager.getContextForAI()}`);
                            actionResults.push(`⚠️ **NOTE**: You updated TODOs but didn't do any actual work. In the next iteration, DO THE WORK: search for files, read files, analyze code, or propose changes related to the active TODOs.`);
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
                
                // Check for file reading loops - if same files read repeatedly without progress
                if (filesReadInIteration === 0 && thinkResponse.action === 'read_file' && iteration > 3) {
                    const recentReadActions = steps.slice(-3).filter(s => s.action === 'read_file');
                    if (recentReadActions.length >= 2) {
                        logInfo(`⚠️ Detected file reading loop: attempting to read same files repeatedly without progress. Warning AI.`);
                        actionResults.push(`⚠️ **CRITICAL**: You've been trying to read the same files repeatedly without making progress. You've read ${readFiles.size} files so far. Instead of reading more files, you should:\n1. Use 'analyze_code' to document your findings\n2. Use 'propose_changes' to suggest modifications\n3. Move to the next TODO item if the current one is complete\n**STOP reading files and START analyzing or proposing changes.**`);
                    }
                }
                
                // Check if stuck in TODO update loop
                const recentActions = steps.slice(-3).map(s => s.action);
                const allUpdateTodos = recentActions.every(a => a === 'update_todos');
                if (allUpdateTodos && recentActions.length >= 3 && iteration > 3) {
                    logInfo(`⚠️ Detected loop: ${recentActions.length} consecutive update_todos actions. Warning AI to do actual work.`);
                    const activeTodos = todoManager.getActiveTodos();
                    const todoIds = activeTodos.map(t => t.id).join(', ');
                    actionResults.push(`⚠️ **STOP UPDATING TODOs AND DO ACTUAL WORK**: You've been updating TODOs repeatedly. Pick a TODO to work on (IDs: ${todoIds}) and DO THE WORK: search for files, read files, analyze code, or propose changes. Stop just updating TODO status!`);
                }
                
                // Add action results to conversation as user message
                if (actionResults.length > 0) {
                    conversationMessages.push({
                        role: 'user',
                        content: `## Action Results (Iteration ${iteration})\n\n${actionResults.join('\n\n')}`
                    });
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
            const formattedComment = this.commentFormatter.formatReasoningComment(
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

    // All methods related to file imports, cache, codebase analysis, and comment formatting
    // have been moved to dedicated services:
    // - FileImportAnalyzer: extractImportsFromFile, resolveRelativePath, buildRelationshipMap
    // - FileCacheManager: calculateFileSHA, loadAICache, saveAICacheEntry
    // - CodebaseAnalyzer: generateCodebaseAnalysis, generateBasicDescription, generateFallbackFileDescriptions, formatCodebaseAnalysisForContext
    // - FileSearchService: buildFileIndex, searchFiles
    // - CommentFormatter: formatReasoningComment, formatProposedChange, detectLanguageFromPath, getActionEmoji, formatActionName, getChangeTypeEmoji

    private async performReasoningStep(
        param: Execution,
        question: string,
        description: string,
        codeManager: ThinkCodeManager,
        todoManager: ThinkTodoManager,
        fileIndex: Map<string, string[]>,
        analyzedFiles: Map<string, FileAnalysis>,
        readFiles: Set<string>,
        fileAnalysisMap: Map<string, { description: string; consumes: string[]; consumed_by: string[] }>,
        iteration: number,
        previousSteps: ThinkStep[],
        conversationMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
    ): Promise<ThinkResponse | undefined> {
        
        const codeStats = codeManager.getStats();
        const todoContext = todoManager.getContextForAI();
        const todoStats = todoManager.getStats();
        const allFiles = Array.from(codeManager.getAllFiles().keys()).sort();
        
        // Helper to add user message to conversation
        const addUserMessage = (content: string) => {
            conversationMessages.push({ role: 'user', content });
        };

        if (iteration === 1) {
            // First iteration: Build system + user message with full context
            const systemMessage = `You are an advanced code analysis assistant similar to Cursor's Auto agent. Your role is to perform deep analysis of codebases and propose thoughtful changes.

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

## Your Analysis Approach

1. **search_files**: Use when you need to find files by name, path, or content keywords. 
   - **DO**: Use SPECIFIC terms like function names, class names, specific file names, or unique identifiers
   - **DON'T**: Use glob patterns or generic terms like "init", "setup", "request", "config", "util"
2. **read_file**: Use when you need to examine specific files. You can read up to ${this.MAX_FILES_PER_READ} files per iteration.
3. **analyze_code**: Use when you've read files and want to document findings.
4. **propose_changes**: Use when you have enough context. Only propose NEW changes that build upon what's already been done.
5. **update_todos**: Create TODOs ONLY in your first iteration. After that, ONLY update existing TODOs. Use EXACT TODO IDs (e.g., "todo_1").
6. **complete**: Use when your analysis is finished. All TODOs should be completed or cancelled.

## Critical Instructions

- **TODOs**: Create TODOs in iteration 1 ONLY. After that, work on existing TODOs, NEVER create new ones.
- **WORK ON TODOs**: When a TODO is "pending" or "in_progress", DO REAL WORK (search, read, analyze, propose) in the SAME response where you update it.
- **AVOID REPETITION**: Don't search for the same files repeatedly. Don't propose changes that have already been applied.
- **BUILD INCREMENTALLY**: Each step should build upon the previous one.
- **BE SPECIFIC**: When proposing changes, be very specific and provide suggested_code.

You must return a valid JSON object matching the schema.`;

            const userMessage = `${description ? `## Context/Issue Description:\n\`\`\`\n${description}\n\`\`\`\n\n` : ''}## User's Question/Prompt:
\`\`\`
${question}
\`\`\`

## Repository Information

**Total files**: ${codeStats.totalFiles}

**Available files**:
${allFiles.map(f => `- \`${f}\``).join('\n')}

**IMPORTANT**: 
- You can read up to ${this.MAX_FILES_PER_READ} files per iteration using the \`read_file\` action
- When searching, use SPECIFIC terms like function names, class names, or specific file names
- AVOID generic terms like "init", "setup", "request", "config" - these match too many files

${todoStats.total > 0 ? `\n${todoContext}\n\n**CRITICAL**: To work on a TODO, use its EXACT ID (shown above) when updating. Don't just update status - DO THE ACTUAL WORK (search, read, analyze, propose) in the same response where you update the TODO.` : `\n## 📋 TODO List\n\n**IMPORTANT**: In your first response, create a TODO list breaking down the problem into manageable tasks (3-5 TODOs is usually enough). Use the \`todo_updates.create\` field to create initial TODOs. Each TODO represents a high-level task that may require multiple reasoning steps to complete.`}

You are starting your analysis. Begin by understanding the question and identifying what files or areas of the codebase might be relevant.`;

            conversationMessages.push(
                { role: 'system', content: systemMessage },
                { role: 'user', content: userMessage }
            );
        } else {
            // Subsequent iterations: Build user message with only new context
            const newContext: string[] = [];
            
            // Add TODO context if it exists
            if (todoStats.total > 0) {
                newContext.push(todoContext);
                newContext.push(`\n**CRITICAL**: Work on existing TODOs. Use EXACT IDs (e.g., "todo_1"). DO NOT create new TODOs.`);
            }
            
            // Add code state if there are changes
            if (codeStats.totalChanges > 0) {
                newContext.push(`\n## Code State: ${codeStats.totalChanges} changes applied to ${codeStats.modifiedFiles} files`);
                newContext.push(codeManager.getContextForAI());
            }
            
            // Add read files summary
            const readFilesList = Array.from(readFiles);
            if (readFilesList.length > 0) {
                newContext.push(`\n## Files Already Read (${readFilesList.length}):\n${readFilesList.map(f => `- ${f}`).join('\n')}\n\n**DO NOT read these files again.** Use 'analyze_code' or 'propose_changes' instead.`);
            }
            
            // Add analyzed files summary
            const analyzedFilesList = Array.from(analyzedFiles.values());
            if (analyzedFilesList.length > 0) {
                newContext.push(`\n## Previously Analyzed Files (${analyzedFilesList.length}):\n${analyzedFilesList.map(f => `- ${f.path}`).join('\n')}`);
            }
            
            // Add iteration info
            newContext.push(`\n## Iteration ${iteration}/${this.MAX_ITERATIONS}\n\nContinue your analysis. Build upon previous steps.`);
            
            if (newContext.length > 0) {
                addUserMessage(newContext.join('\n'));
            }
        }

        try {
            const response = await this.aiRepository.askThinkJson(param.ai, conversationMessages);
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

    /**
     * Check if the model is an Anthropic Claude model
     */
    private isClaudeModel(model: string): boolean {
        if (!model) return false;
        const modelLower = model.toLowerCase();
        return modelLower.includes('claude') || modelLower.includes('anthropic');
    }

    /**
     * Detect generic search terms that are too common and not useful
     */
    private detectGenericSearchTerms(searchTerms: string[]): string[] {
        const genericTerms = [
            'init', 'initialize', 'setup', 'config', 'configuration',
            'request', 'response', 'util', 'utils', 'helper', 'helpers',
            'common', 'base', 'main', 'index', 'types', 'type',
            'model', 'models', 'data', 'api', 'service', 'services',
            'handler', 'handlers', 'manager', 'managers', 'repository', 'repositories'
        ];
        
        return searchTerms.filter(term => {
            const termLower = term.toLowerCase();
            return genericTerms.some(generic => termLower === generic || termLower.includes(generic));
        });
    }
}
