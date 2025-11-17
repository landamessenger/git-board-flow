import { Execution } from '../../data/model/execution';
import { Result } from '../../data/model/result';
import { FileRepository } from '../../data/repository/file_repository';
import { SupabaseRepository, AICachedFileInfo } from '../../data/repository/supabase_repository';
import { AiRepository } from '../../data/repository/ai_repository';
import { logError, logInfo, logSingleLine, logDebugInfo } from '../../utils/logger';
import { ParamUseCase } from '../base/param_usecase';
import { FileImportAnalyzer } from '../steps/common/services/file_import_analyzer';
import { FileCacheManager } from '../steps/common/services/file_cache_manager';
import { CodebaseAnalyzer } from '../steps/common/services/codebase_analyzer';
import { PROMPTS } from '../../utils/constants';
import { BranchRepository } from '../../data/repository/branch_repository';
import { ErrorDetector } from '../../agent/reasoning/error_detector/error_detector';
import { ErrorDetectionOptions, ErrorDetectionResult } from '../../agent/reasoning/error_detector/types';

export class VectorActionUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'VectorActionUseCase';
    private fileRepository: FileRepository = new FileRepository();
    private branchRepository: BranchRepository = new BranchRepository();
    private aiRepository: AiRepository = new AiRepository();
    private fileImportAnalyzer: FileImportAnalyzer = new FileImportAnalyzer();
    private fileCacheManager: FileCacheManager = new FileCacheManager();
    private codebaseAnalyzer: CodebaseAnalyzer;
    
    constructor() {
        // Initialize CodebaseAnalyzer with dependencies
        this.codebaseAnalyzer = new CodebaseAnalyzer(
            this.aiRepository,
            this.fileImportAnalyzer,
            this.fileCacheManager
        );
    }

    async invoke(param: Execution): Promise<Result[]> {
        logInfo(`Executing ${this.taskId}.`)

        const results: Result[] = [];

        try {
            if (!param.supabaseConfig) {
                results.push(
                    new Result({
                        id: this.taskId,
                        success: false,
                        executed: true,
                        steps: [
                            `Supabase config not found.`,
                        ],
                    })
                )
                return results;
            }

            // Check if AI configuration is available
            if (!param.ai || !param.ai.getOpenRouterModel() || !param.ai.getOpenRouterApiKey()) {
                logError(`Missing required AI configuration. Please provide OPENROUTER_API_KEY and OPENROUTER_MODEL. ${JSON.stringify(param.ai, null, 2)}`);
                results.push(
                    new Result({
                        id: this.taskId,
                        success: false,
                        executed: true,
                        errors: [
                            `Missing required AI configuration. Please provide OPENROUTER_API_KEY and OPENROUTER_MODEL.`,
                        ],
                    })
                )
                return results;
            }

            let branchesToProcess: string[] = [];
            if (param.commit.branch) {
                branchesToProcess.push(param.commit.branch);
            }

            if (branchesToProcess.length === 0) {
                branchesToProcess = await this.branchRepository.getListOfBranches(
                    param.owner,
                    param.repo,
                    param.tokens.token
                );
            }

            logInfo(`📦 ${branchesToProcess.length} branches to process.`);

            const branchResults: Array<{ branch: string; filesProcessed: number; filesReused: number; filesSkipped: number; filesGenerated: number; filesRemoved: number; duration: number; success: boolean }> = [];
            
            for (let i = 0; i < branchesToProcess.length; i++) {
                const branch = branchesToProcess[i];
                const branchProgress = ((i + 1) / branchesToProcess.length) * 100;
                logSingleLine(`📦 [${i + 1}/${branchesToProcess.length}] (${branchProgress.toFixed(1)}%) Processing branch: ${branch}...`);
                
                const branchStartTime = Date.now();
                const branchResult = await this.prepareCacheOnBranch(param, branch, i + 1, branchesToProcess.length);
                const branchDuration = Math.ceil((Date.now() - branchStartTime) / 1000);
                
                results.push(...branchResult.results);
                branchResults.push({
                    branch,
                    filesProcessed: branchResult.filesProcessed,
                    filesReused: branchResult.filesReused,
                    filesSkipped: branchResult.filesSkipped,
                    filesGenerated: branchResult.filesGenerated,
                    filesRemoved: branchResult.filesRemoved,
                    duration: branchDuration,
                    success: branchResult.success
                });
            }
            
            // Print all results at the end
            logInfo(``); // Empty line for clarity
            logInfo(`📦 Processing Summary:`);
            for (const result of branchResults) {
                if (result.success) {
                    logInfo(`  ✅ ${result.branch}: ${result.filesProcessed} processed, ${result.filesReused} reused, ${result.filesSkipped} skipped, ${result.filesGenerated} generated, ${result.filesRemoved} removed. Duration: ${result.duration}s`);
                } else {
                    logInfo(`  ❌ ${result.branch}: Failed`);
                }
            }

            // Get all branches from GitHub for orphaned branch detection
            const allGitHubBranches = await this.branchRepository.getListOfBranches(
                param.owner,
                param.repo,
                param.tokens.token
            );
            results.push(...await this.removeOrphanedBranches(param, allGitHubBranches));

            results.push(
                new Result({
                    id: this.taskId,
                    success: true,
                    executed: true,
                    steps: [
                        `Vector action executed successfully.`,
                    ],
                })
            );

        } catch (error) {
            logError(`Error in ${this.taskId}: ${JSON.stringify(error, null, 2)}`);
            results.push(
                new Result({
                    id: this.taskId,
                    success: false,
                    executed: true,
                    errors: [
                        `Error in ${this.taskId}: ${JSON.stringify(error, null, 2)}`,
                    ],
                })
            );
        }

        return results;
    }

    private prepareCacheOnBranch = async (
        param: Execution, 
        branch: string, 
        branchIndex: number = 1, 
        totalBranches: number = 1
    ): Promise<{
        results: Result[];
        filesProcessed: number;
        filesReused: number;
        filesSkipped: number;
        filesGenerated: number;
        filesRemoved: number;
        success: boolean;
    }> => {
        const results: Result[] = [];
        let filesProcessed = 0;
        let filesReused = 0;
        let filesSkipped = 0;
        let filesGenerated = 0;
        let filesRemoved = 0;
        let success = false;
        
        if (!param.supabaseConfig) {
            results.push(
                new Result({
                    id: this.taskId,
                    success: false,
                    executed: true,
                    steps: [
                        `Supabase config not found.`,
                    ],
                })
            )
            return {
                results,
                filesProcessed: 0,
                filesReused: 0,
                filesSkipped: 0,
                filesGenerated: 0,
                filesRemoved: 0,
                success: false
            };
        }

        // Check if AI configuration is available
        if (!param.ai || !param.ai.getOpenRouterModel() || !param.ai.getOpenRouterApiKey()) {
            logError(`Missing required AI configuration. Please provide OPENROUTER_API_KEY and OPENROUTER_MODEL.`);
            results.push(
                new Result({
                    id: this.taskId,
                    success: false,
                    executed: true,
                    errors: [
                        `Missing required AI configuration. Please provide OPENROUTER_API_KEY and OPENROUTER_MODEL.`,
                    ],
                })
            )
            return {
                results,
                filesProcessed: 0,
                filesReused: 0,
                filesSkipped: 0,
                filesGenerated: 0,
                filesRemoved: 0,
                success: false
            };
        }

        const supabaseRepository: SupabaseRepository = new SupabaseRepository(param.supabaseConfig);

        try {
            const branchProgress = `[${branchIndex}/${totalBranches}]`;
            
            const repositoryFiles = await this.fileRepository.getRepositoryContent(
                param.owner,
                param.repo,
                param.tokens.token,
                branch,
                param.ai.getAiIgnoreFiles(),
                (fileName: string) => {
                    // Silent - files are processed in background
                },
                (fileName: string) => {
                    // Silent - ignored files
                }
            );
            
            logSingleLine(`📦 ${branchProgress} Branch ${branch}: Found ${repositoryFiles.size} files to process...`);

            if (repositoryFiles.size === 0) {
                logSingleLine(`📦 ${branchProgress} Branch ${branch}: No files found, skipping.`);
                results.push(
                    new Result({
                        id: this.taskId,
                        success: true,
                        executed: true,
                        steps: [
                            `No files found in branch ${branch}, nothing to process.`,
                        ],
                    })
                );
                return {
                    results,
                    filesProcessed: 0,
                    filesReused: 0,
                    filesSkipped: 0,
                    filesGenerated: 0,
                    filesRemoved: 0,
                    success: true
                };
            }

            const startTime = Date.now();
            const filePaths = Array.from(repositoryFiles.keys());
            
            // Step 1: Build relationship map once for all files
            logSingleLine(`📦 ${branchProgress} Branch ${branch}: Building relationship map for ${repositoryFiles.size} files...`);
            const relationshipMaps = this.fileImportAnalyzer.buildRelationshipMap(repositoryFiles);
            const consumesMap = relationshipMaps.consumes;
            const consumedByMap = relationshipMaps.consumedBy;

            // Process each file
            for (let i = 0; i < filePaths.length; i++) {
                const filePath = filePaths[i];
                const fileContent = repositoryFiles.get(filePath) || '';
                const progress = ((i + 1) / filePaths.length) * 100;
                const currentTime = Date.now();
                const elapsedTime = (currentTime - startTime) / 1000; // in seconds
                const estimatedTotalTime = (elapsedTime / (i + 1)) * filePaths.length;
                const remainingTime = estimatedTotalTime - elapsedTime;

                logSingleLine(`📦 ${branchProgress} Branch ${branch}: Processing files ${i + 1}/${filePaths.length} (${progress.toFixed(1)}%) | ETA: ${Math.ceil(remainingTime)}s | Current: ${filePath.split('/').pop() || filePath}`);

                // Paths from file_repository are already normalized, use directly
                const normalizedPath = filePath;
                
                // Calculate SHA for comparison
                const currentSHA = this.fileCacheManager.calculateFileSHA(fileContent);
                
                // Check if file already exists in target branch with same SHA
                const remoteShasum = await supabaseRepository.getShasumByPath(
                    param.owner,
                    param.repo,
                    branch,
                    normalizedPath
                );

                if (remoteShasum === currentSHA) {
                    // File already exists with same SHA - skip
                    filesSkipped++;
                    continue;
                }
                

                // Check if this SHA exists in any branch (to reuse description and errors)
                const existingCache = await supabaseRepository.getAIFileCacheBySha(
                    param.owner,
                    param.repo,
                    currentSHA
                );

                // Extract imports for this file (from pre-built map)
                const consumes = consumesMap.get(filePath) || [];
                const consumedBy = consumedByMap.get(filePath) || [];
                
                let description: string;
                let errorCounterTotal = 0;
                let errorCounterCritical = 0;
                let errorCounterHigh = 0;
                let errorCounterMedium = 0;
                let errorCounterLow = 0;
                let errorTypes: string[] = [];
                let errorsPayload: string | undefined = undefined;
                
                if (existingCache) {
                    // Reuse description and error information from existing cache
                    description = existingCache.description;
                    errorCounterTotal = existingCache.error_counter_total ?? 0;
                    errorCounterCritical = existingCache.error_counter_critical ?? 0;
                    errorCounterHigh = existingCache.error_counter_high ?? 0;
                    errorCounterMedium = existingCache.error_counter_medium ?? 0;
                    errorCounterLow = existingCache.error_counter_low ?? 0;
                    errorTypes = existingCache.error_types ?? [];
                    errorsPayload = existingCache.errors_payload;
                    filesReused++;
                } else {
                    // Generate new description using AI
                    filesGenerated++;
                    
                    description = this.codebaseAnalyzer.generateBasicDescription(filePath);
                    try {
                        // Create schema for single file description
                        const FILE_DESCRIPTION_SCHEMA = {
                            "type": "object",
                            "description": "File description",
                            "properties": {
                                "description": {
                                    "type": "string",
                                    "description": "Description of what the file does."
                                }
                            },
                            "required": ["description"],
                            "additionalProperties": false
                        };
                        
                        const descriptionPrompt = `${PROMPTS.CODE_BASE_ANALYSIS}:

\`\`\`
${fileContent}
\`\`\`

`;
                        
                        const aiResponse = await this.aiRepository.askJson(
                            param.ai,
                            descriptionPrompt,
                            FILE_DESCRIPTION_SCHEMA,
                            "file_description"
                        );
                        
                        if (aiResponse && typeof aiResponse === 'object' && aiResponse.description) {
                            description = aiResponse.description.trim();
                        }
                    } catch (error) {
                        logError(`Error generating AI description for ${filePath}, using fallback: ${error}`);
                    }

                    // Detect errors for this file
                    try {
                        const errorInfo = await this.detectErrorsForFile(
                            param,
                            branch,
                            normalizedPath,
                            fileContent
                        );
                        
                        if (errorInfo) {
                            errorCounterTotal = errorInfo.error_counter_total;
                            errorCounterCritical = errorInfo.error_counter_critical;
                            errorCounterHigh = errorInfo.error_counter_high;
                            errorCounterMedium = errorInfo.error_counter_medium;
                            errorCounterLow = errorInfo.error_counter_low;
                            errorTypes = errorInfo.error_types;
                            errorsPayload = errorInfo.errors_payload;
                        }
                    } catch (error) {
                        logError(`Error detecting errors for ${filePath}: ${JSON.stringify(error, null, 2)}`);
                        // Continue with default values (all zeros)
                    }
                }

                // Remove existing cache if SHA changed
                if (remoteShasum && remoteShasum !== currentSHA) {
                    await supabaseRepository.removeAIFileCacheByPath(
                        param.owner,
                        param.repo,
                        branch,
                        normalizedPath
                    );
                }

                // Save to Supabase
                try {
                    const fileName = normalizedPath.split('/').pop() || normalizedPath;
                    // Use normalizedPath directly to ensure consistency with the query path
                    const normalizedConsumes = consumes.map(p => p.replace(/^\.\//, '').replace(/\\/g, '/').trim());
                    const normalizedConsumedBy = consumedBy.map(p => p.replace(/^\.\//, '').replace(/\\/g, '/').trim());
                    
                    await supabaseRepository.setAIFileCache(
                        param.owner,
                        param.repo,
                        branch,
                        {
                            file_name: fileName,
                            path: normalizedPath, // Use the same normalizedPath used for querying
                            sha: currentSHA,
                            description: description,
                            consumes: normalizedConsumes,
                            consumed_by: normalizedConsumedBy,
                            error_counter_total: errorCounterTotal,
                            error_counter_critical: errorCounterCritical,
                            error_counter_high: errorCounterHigh,
                            error_counter_medium: errorCounterMedium,
                            error_counter_low: errorCounterLow,
                            error_types: errorTypes,
                            errors_payload: errorsPayload
                        }
                    );
                    
                    filesProcessed++;
                } catch (error) {
                    const errorData = JSON.stringify(error, null, 2);
                    if (errorData.includes('Please try again in a few minutes.')) {
                        logError(`Error saving AI cache for ${filePath}: Exceeded rate limit, please try again in a few minutes.`);
                    } else {
                        logError(`Error saving AI cache for ${filePath}: ${JSON.stringify(error, null, 2)}`);
                    }
                }
            }

            // Step 2: Check for files that exist in Supabase but no longer exist in the repository
            // logSingleLine(`📦 Checking for files to remove from AI cache (deleted files)...`);
            const remotePaths = await supabaseRepository.getDistinctPaths(
                param.owner,
                param.repo,
                branch,
            );

            // Paths from file_repository are already normalized, use directly
            const localPaths = new Set<string>();
            for (const filePath of repositoryFiles.keys()) {
                localPaths.add(filePath);
            }

            // Find paths that exist in Supabase but not in the current branch
            const pathsToRemove = remotePaths.filter(path => !localPaths.has(path));

            let filesRemoved = 0;
            if (pathsToRemove.length > 0) {
                logSingleLine(`📦 ${branchProgress} Branch ${branch}: Removing ${pathsToRemove.length} deleted files from cache...`);
                
                for (const path of pathsToRemove) {
                    try {
                        await supabaseRepository.removeAIFileCacheByPath(
                            param.owner,
                            param.repo,
                            branch,
                            path
                        );
                        filesRemoved++;
                    } catch (error) {
                        logError(`📦 ❌ Error removing AI cache for path ${path}: ${JSON.stringify(error, null, 2)}`);
                    }
                }

                if (filesRemoved > 0) {
                    results.push(
                        new Result({
                            id: this.taskId,
                            success: true,
                            executed: true,
                            steps: [
                                `Removed ${filesRemoved} paths from AI index as they no longer exist in \`${branch}\`.`,
                            ],
                        })
                    );
                }
            }

            const totalDurationSeconds = (Date.now() - startTime) / 1000;
            success = true;
            
            results.push(
                new Result({
                    id: this.taskId,
                    success: true,
                    executed: true,
                    steps: [
                        `Processed AI cache for \`${branch}\`. ${filesProcessed} processed, ${filesReused} reused from other branches, ${filesSkipped} skipped, ${filesGenerated} generated, ${filesRemoved} removed. Total duration: ${Math.ceil(totalDurationSeconds)} seconds`,
                    ],
                })
            );
        } catch (error) {
            logError(`📦 ❌ Error processing AI cache for branch ${branch}: ${JSON.stringify(error, null, 2)}`);
            success = false;
            results.push(
                new Result({
                    id: this.taskId,
                    success: false,
                    executed: true,
                    errors: [
                        `Error processing AI cache for branch ${branch}: ${JSON.stringify(error, null, 2)}`,
                    ],
                })
            );
        }

        return {
            results,
            filesProcessed,
            filesReused,
            filesSkipped,
            filesGenerated,
            filesRemoved,
            success
        };
    }

    private removeOrphanedBranches = async (param: Execution, githubBranches: string[]) => {
        const results: Result[] = [];
        
        if (!param.supabaseConfig) {
            results.push(
                new Result({
                    id: this.taskId,
                    success: false,
                    executed: true,
                    steps: [
                        `Supabase config not found.`,
                    ],
                })
            )
            return results;
        }

        const supabaseRepository: SupabaseRepository = new SupabaseRepository(param.supabaseConfig);

        try {
            logInfo(`📦 Checking for orphaned branches in Supabase (branches that no longer exist in GitHub)...`);
            
            // Get all branches from Supabase
            const supabaseBranches = await supabaseRepository.getDistinctBranches(
                param.owner,
                param.repo
            );

            if (supabaseBranches.length === 0) {
                logInfo(`📦 No branches found in Supabase, nothing to clean.`);
                results.push(
                    new Result({
                        id: this.taskId,
                        success: true,
                        executed: true,
                        steps: [
                            `No branches found in Supabase, nothing to clean.`,
                        ],
                    })
                );
                return results;
            }

            // Create a Set for faster lookup
            const githubBranchesSet = new Set(githubBranches);

            // Find branches that exist in Supabase but not in GitHub
            const orphanedBranches = supabaseBranches.filter(branch => !githubBranchesSet.has(branch));

            if (orphanedBranches.length === 0) {
                logInfo(`📦 No orphaned branches found. All Supabase branches exist in GitHub.`);
                results.push(
                    new Result({
                        id: this.taskId,
                        success: true,
                        executed: true,
                        steps: [
                            `No orphaned branches found. All Supabase branches exist in GitHub.`,
                        ],
                    })
                );
                return results;
            }

            logInfo(`📦 Found ${orphanedBranches.length} orphaned branch(es) to remove: ${orphanedBranches.join(', ')}`);

            let branchesRemoved = 0;
            for (const branch of orphanedBranches) {
                try {
                    await supabaseRepository.removeAIFileCacheByBranch(
                        param.owner,
                        param.repo,
                        branch
                    );
                    branchesRemoved++;
                    logInfo(`📦 ✅ Removed AI cache for orphaned branch: ${branch}`);
                } catch (error) {
                    logError(`📦 ❌ Error removing AI cache for orphaned branch ${branch}: ${JSON.stringify(error, null, 2)}`);
                }
            }

            if (branchesRemoved > 0) {
                results.push(
                    new Result({
                        id: this.taskId,
                        success: true,
                        executed: true,
                        steps: [
                            `Removed ${branchesRemoved} orphaned branch(es) from AI cache: ${orphanedBranches.slice(0, branchesRemoved).join(', ')}`,
                        ],
                    })
                );
            }

            if (branchesRemoved < orphanedBranches.length) {
                results.push(
                    new Result({
                        id: this.taskId,
                        success: false,
                        executed: true,
                        errors: [
                            `Failed to remove ${orphanedBranches.length - branchesRemoved} orphaned branch(es).`,
                        ],
                    })
                );
            }

        } catch (error) {
            logError(`📦 ❌ Error checking for orphaned branches: ${JSON.stringify(error, null, 2)}`);
            results.push(
                new Result({
                    id: this.taskId,
                    success: false,
                    executed: true,
                    errors: [
                        `Error checking for orphaned branches: ${JSON.stringify(error, null, 2)}`,
                    ],
                })
            );
        }

        return results;
    }

    /**
     * Detect errors for a specific file using ErrorDetector
     * Analyzes only the target file, ignoring related files
     */
    private detectErrorsForFile = async (
        param: Execution,
        branch: string,
        filePath: string,
        fileContent: string
    ): Promise<{
        error_counter_total: number;
        error_counter_critical: number;
        error_counter_high: number;
        error_counter_medium: number;
        error_counter_low: number;
        error_types: string[];
        errors_payload: string;
    } | null> => {
        try {
            // Check if AI configuration is available
            if (!param.ai || !param.ai.getOpenRouterModel() || !param.ai.getOpenRouterApiKey()) {
                logDebugInfo(`Skipping error detection for ${filePath}: Missing AI configuration`);
                return null;
            }

            // Create ErrorDetector options for single file analysis
            const detectorOptions: ErrorDetectionOptions = {
                model: param.ai.getOpenRouterModel(),
                apiKey: param.ai.getOpenRouterApiKey(),
                personalAccessToken: param.tokens.token, // GitHub token for loading repository files
                maxTurns: 10, // Reduced for single file analysis to prevent loops
                repositoryOwner: param.owner,
                repositoryName: param.repo,
                repositoryBranch: branch,
                targetFile: filePath,
                analyzeOnlyTargetFile: true, // Only analyze this file, ignore related files
                useSubAgents: true // Single file doesn't need subagents
            };

            const detector = new ErrorDetector(detectorOptions);
            
            // Detect errors - use structured prompt similar to subagents to prevent loops
            // The structured format helps the agent understand when to stop
            const result: ErrorDetectionResult = await detector.detectErrors(
                `You have been assigned 1 file to analyze: ${filePath}

**CRITICAL INSTRUCTIONS:**
1. Read the file using read_file: ${filePath}
2. Analyze it thoroughly for errors, bugs, vulnerabilities, and code quality issues
3. Call report_errors ONCE with ALL errors you found in this file
4. After calling report_errors, provide a brief final summary text response and STOP
5. **DO NOT call report_errors multiple times** - call it once with all errors, then provide your summary and finish
6. **You have exactly 1 file to analyze** - after analyzing it and reporting errors, you are DONE`
            );

            // Extract error information from result
            const { errors, summary } = result;
            
            // Get unique error types
            const uniqueErrorTypes = Array.from(new Set(errors.map(e => e.type)));
            
            // Create errors payload as JSON string
            const errorsPayload = JSON.stringify(errors);

            return {
                error_counter_total: summary.total,
                error_counter_critical: summary.bySeverity.critical,
                error_counter_high: summary.bySeverity.high,
                error_counter_medium: summary.bySeverity.medium,
                error_counter_low: summary.bySeverity.low,
                error_types: uniqueErrorTypes,
                errors_payload: errorsPayload
            };
        } catch (error) {
            logError(`Error in detectErrorsForFile for ${filePath}: ${JSON.stringify(error, null, 2)}`);
            return null;
        }
    }
}
