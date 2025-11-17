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

/**
 * VectorActionUseCase - Processes repository files and creates AI cache in Supabase.
 * 
 * This use case is responsible for:
 * - Processing files from GitHub repositories and generating AI descriptions
 * - Caching file metadata (descriptions, imports, error information) in Supabase
 * - Detecting and removing orphaned branches from the cache
 * - Reusing cached data across branches when files have the same SHA
 * 
 * @internal
 * This class is used internally by the SingleActionUseCase when the AI cache action is triggered.
 * It processes files sequentially per branch and maintains a cache of file metadata for efficient
 * codebase analysis and search operations.
 */
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

    /**
     * Main entry point for the VectorActionUseCase.
     * 
     * Processes repository files and creates/updates AI cache in Supabase. The process includes:
     * 1. Validating configuration (Supabase, AI)
     * 2. Determining which branches to process (specific branch or all branches)
     * 3. Processing each branch: analyzing files, generating descriptions, detecting errors
     * 4. Cleaning up orphaned branches (branches that no longer exist in GitHub)
     * 
     * @internal
     * This method orchestrates the entire cache building process. It handles errors gracefully
     * and continues processing even if individual branches fail.
     * 
     * @param param - Execution parameters containing repository info, tokens, AI config, and Supabase config
     * @returns Array of Result objects indicating success/failure of each operation
     * 
     * @remarks
     * - If no specific branch is provided via `param.commit.branch`, all branches are processed
     * - Orphaned branch detection runs after processing all branches to ensure accurate comparison
     * - Each branch is processed independently; failures in one branch don't stop processing of others
     * 
     * @example
     * ```typescript
     * const useCase = new VectorActionUseCase();
     * const results = await useCase.invoke(execution);
     * // Results contain information about processed files, reused cache, and orphaned branches
     * ```
     */
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
            // IMPORTANT: This must be done separately from branchesToProcess to ensure we check against ALL branches.
            // If we only checked against branchesToProcess, we would incorrectly mark branches like 'develop' as
            // orphaned when processing a single branch, even though 'develop' still exists in GitHub.
            // 
            // @internal This is the key fix for bug #280: wrong orphaned branches detection
            let allGitHubBranches: string[] = [];
            try {
                allGitHubBranches = await this.branchRepository.getListOfBranches(
                    param.owner,
                    param.repo,
                    param.tokens.token
                );
                logInfo(`📦 Retrieved ${allGitHubBranches.length} branch(es) from GitHub for orphaned branch detection.`);
            } catch (error) {
                logError(`📦 ❌ Error retrieving branches from GitHub for orphaned branch detection: ${JSON.stringify(error, null, 2)}`);
                results.push(
                    new Result({
                        id: this.taskId,
                        success: false,
                        executed: true,
                        errors: [
                            `Error retrieving branches from GitHub for orphaned branch detection: ${JSON.stringify(error, null, 2)}`,
                        ],
                    })
                );
                // Continue execution even if we can't check for orphaned branches
            }
            
            if (allGitHubBranches.length > 0) {
                results.push(...await this.removeOrphanedBranches(param, allGitHubBranches));
            } else {
                logInfo(`📦 Skipping orphaned branch detection: No branches retrieved from GitHub.`);
            }

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

    /**
     * Processes and caches files for a specific branch.
     * 
     * This method handles the complete file processing pipeline for a single branch:
     * 1. Retrieves all files from the repository for the given branch
     * 2. Builds relationship maps (imports/exports) for all files
     * 3. For each file:
     *    - Calculates SHA to check if file has changed
     *    - Skips if SHA matches existing cache (optimization)
     *    - Reuses description/errors if SHA exists in another branch
     *    - Generates new AI description if file is new or changed
     *    - Detects errors using ErrorDetector
     *    - Saves metadata to Supabase
     * 4. Removes files from cache that no longer exist in the repository
     * 
     * @internal
     * This is a private method called by invoke() for each branch. It's designed to be
     * idempotent - running it multiple times on the same branch is safe and efficient.
     * 
     * @param param - Execution parameters
     * @param branch - Branch name to process
     * @param branchIndex - Current branch index (for progress logging)
     * @param totalBranches - Total number of branches being processed (for progress logging)
     * 
     * @returns Object containing:
     *   - results: Array of Result objects for this branch
     *   - filesProcessed: Number of files successfully processed and saved
     *   - filesReused: Number of files that reused cache from other branches
     *   - filesSkipped: Number of files skipped (unchanged, same SHA)
     *   - filesGenerated: Number of files that required new AI description generation
     *   - filesRemoved: Number of files removed from cache (no longer in repository)
     *   - success: Whether the branch processing completed successfully
     * 
     * @remarks
     * - File processing is optimized: files with unchanged SHA are skipped entirely
     * - SHA-based reuse allows sharing descriptions across branches for identical files
     * - Error detection is optional and failures don't block file caching
     * - The cleanup phase (removing deleted files) runs after processing all files
     * 
     * @example
     * ```typescript
     * const result = await prepareCacheOnBranch(execution, 'develop', 1, 3);
     * // result.filesProcessed = 150, result.filesReused = 50, result.filesSkipped = 200
     * ```
     */
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
            // @internal This is done once upfront for performance - analyzing imports/exports for all files
            // in a single pass is more efficient than analyzing each file individually
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
                // @internal SHA is used as a content fingerprint - identical files across branches
                // share the same SHA, allowing us to reuse AI-generated descriptions and error data
                const currentSHA = this.fileCacheManager.calculateFileSHA(fileContent);
                
                // Check if file already exists in target branch with same SHA
                // @internal Early exit optimization: if SHA matches, file hasn't changed, skip processing
                const remoteShasum = await supabaseRepository.getShasumByPath(
                    param.owner,
                    param.repo,
                    branch,
                    normalizedPath
                );

                if (remoteShasum === currentSHA) {
                    // File already exists with same SHA - skip
                    // @internal This optimization significantly reduces processing time for unchanged files
                    filesSkipped++;
                    continue;
                }
                

                // Check if this SHA exists in any branch (to reuse description and errors)
                // @internal Cross-branch optimization: if the same file content exists in another branch,
                // we can reuse the AI-generated description and error analysis, saving API calls
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
                    // @internal This path is taken when file is new or changed (SHA doesn't exist in cache)
                    filesGenerated++;
                    
                    // @internal Fallback description based on file path structure (e.g., "usecase", "repository")
                    description = this.codebaseAnalyzer.generateBasicDescription(filePath);
                    try {
                        // Create schema for single file description
                        // @internal Structured JSON response ensures consistent format and reduces parsing errors
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
                        
                        // @internal AI call to generate file description - this is the most expensive operation
                        // so we try to reuse descriptions whenever possible via SHA matching
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
                        // @internal If AI description generation fails, we continue with fallback description
                        // This ensures file processing doesn't stop due to AI API issues
                        logError(`Error generating AI description for ${filePath}, using fallback: ${error}`);
                    }

                    // Detect errors for this file
                    // @internal Error detection is optional and runs in parallel with description generation
                    // Failures in error detection don't block file caching
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
                        // @internal Error detection failures are logged but don't block file processing
                        // Default values (all zeros) are used if detection fails
                        logError(`Error detecting errors for ${filePath}: ${JSON.stringify(error, null, 2)}`);
                        // Continue with default values (all zeros)
                    }
                }

                // Remove existing cache if SHA changed
                // @internal When file content changes (SHA differs), we remove old cache entry before saving new one
                // This ensures cache consistency and prevents stale data
                if (remoteShasum && remoteShasum !== currentSHA) {
                    await supabaseRepository.removeAIFileCacheByPath(
                        param.owner,
                        param.repo,
                        branch,
                        normalizedPath
                    );
                }

                // Save to Supabase
                // @internal All file metadata is saved in a single transaction per file
                // This includes description, imports/exports, error counts, and error details
                try {
                    const fileName = normalizedPath.split('/').pop() || normalizedPath;
                    // Use normalizedPath directly to ensure consistency with the query path
                    // @internal Path normalization ensures consistent storage and retrieval
                    // Removes leading './' and normalizes path separators (Windows vs Unix)
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
            // @internal This cleanup phase runs after processing all files to identify and remove
            // files that were deleted from the repository but still exist in the cache
            // logSingleLine(`📦 Checking for files to remove from AI cache (deleted files)...`);
            const remotePaths = await supabaseRepository.getDistinctPaths(
                param.owner,
                param.repo,
                branch,
            );

            // Paths from file_repository are already normalized, use directly
            // @internal Using Set for O(1) lookup performance when comparing paths
            const localPaths = new Set<string>();
            for (const filePath of repositoryFiles.keys()) {
                localPaths.add(filePath);
            }

            // Find paths that exist in Supabase but not in the current branch
            // @internal This identifies orphaned file entries that need to be cleaned up
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

    /**
     * Removes orphaned branches from Supabase AI cache.
     * 
     * An orphaned branch is a branch that exists in Supabase but no longer exists in GitHub.
     * This method compares all branches in Supabase against all branches in GitHub to identify
     * and remove orphaned branches.
     * 
     * @internal
     * This is an internal method used by the VectorActionUseCase. It should not be called directly.
     * 
     * @param param - Execution parameters containing owner, repo, and Supabase config
     * @param githubBranches - Array of all branch names that exist in GitHub (must be complete list, not just processed branches)
     * 
     * @returns Array of Result objects indicating success/failure of the operation
     * 
     * @remarks
     * - Branch names are normalized (trimmed) before comparison
     * - Comparison is case-sensitive (GitHub branch names are case-sensitive)
     * - Invalid branch names (null, undefined, empty) are filtered out
     * - If removal of a branch fails, the error is logged but processing continues
     * 
     * @example
     * ```typescript
     * // This method is called internally by invoke() after processing branches
     * // It receives ALL branches from GitHub, not just the ones being processed
     * const allBranches = await branchRepository.getListOfBranches(owner, repo, token);
     * const results = await removeOrphanedBranches(execution, allBranches);
     * ```
     */
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
            
            // Validate and normalize GitHub branches
            // Filter out invalid entries (null, undefined, empty strings) and normalize whitespace
            // @internal This prevents false positives from corrupted data
            const normalizedGitHubBranches = githubBranches
                .filter(branch => branch != null && branch !== undefined && branch.trim() !== '')
                .map(branch => branch.trim());
            
            if (normalizedGitHubBranches.length === 0) {
                logInfo(`📦 No valid branches from GitHub to compare against.`);
                results.push(
                    new Result({
                        id: this.taskId,
                        success: true,
                        executed: true,
                        steps: [
                            `No valid branches from GitHub to compare against.`,
                        ],
                    })
                );
                return results;
            }

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

            // Normalize Supabase branches (same normalization as GitHub branches)
            // @internal Ensures consistent comparison between GitHub and Supabase branch names
            const normalizedSupabaseBranches = supabaseBranches
                .filter(branch => branch != null && branch !== undefined && branch.trim() !== '')
                .map(branch => branch.trim());

            // Create a Set for faster O(1) lookup
            // @internal Case-sensitive comparison: GitHub branch names are case-sensitive (e.g., 'develop' != 'Develop')
            const githubBranchesSet = new Set(normalizedGitHubBranches);

            // Debug logging
            logInfo(`📦 Comparing ${normalizedSupabaseBranches.length} Supabase branch(es) against ${normalizedGitHubBranches.length} GitHub branch(es).`);

            // Find branches that exist in Supabase but not in GitHub
            // @internal Uses Set.has() for O(1) lookup performance
            // @internal Logs each orphaned branch for debugging purposes
            const orphanedBranches = normalizedSupabaseBranches.filter(branch => {
                const isOrphaned = !githubBranchesSet.has(branch);
                if (isOrphaned) {
                    logInfo(`📦 Branch '${branch}' found in Supabase but not in GitHub (will be marked as orphaned).`);
                }
                return isOrphaned;
            });

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
     * Detects errors, bugs, and code quality issues in a single file using ErrorDetector.
     * 
     * This method uses the ErrorDetector agent to analyze a file for:
     * - Syntax errors and bugs
     * - Security vulnerabilities
     * - Code quality issues
     * - Best practice violations
     * 
     * The analysis is limited to the target file only (analyzeOnlyTargetFile: true) to:
     * - Reduce processing time
     * - Lower API costs
     * - Prevent analysis loops
     * - Keep error detection focused and fast
     * 
     * @internal
     * This is a private method called during file processing. Error detection is optional
     * and failures don't block file caching. The method is designed to be lightweight
     * and focused on single-file analysis.
     * 
     * @param param - Execution parameters containing AI config and repository info
     * @param branch - Branch name where the file exists
     * @param filePath - Path to the file to analyze
     * @param fileContent - Content of the file to analyze
     * 
     * @returns Object containing error counts by severity and error details, or null if:
     *   - AI configuration is missing
     *   - Error detection fails
     *   - File analysis cannot be completed
     * 
     * @remarks
     * - Uses maxTurns: 10 to prevent infinite loops in error detection
     * - analyzeOnlyTargetFile: true ensures only the target file is analyzed (not dependencies)
     * - Errors are categorized by severity: critical, high, medium, low
     * - Error types are extracted and stored for filtering/searching
     * - Full error details are stored as JSON payload for detailed analysis
     * 
     * @example
     * ```typescript
     * const errorInfo = await detectErrorsForFile(execution, 'develop', 'src/file.ts', content);
     * // errorInfo = { error_counter_total: 5, error_counter_critical: 1, ... }
     * ```
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
