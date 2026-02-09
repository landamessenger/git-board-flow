import { Execution } from '../../data/model/execution';
import { Result } from '../../data/model/result';
import { ParamUseCase } from '../base/param_usecase';
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
export declare class VectorActionUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string;
    private fileRepository;
    private branchRepository;
    private aiRepository;
    private fileImportAnalyzer;
    private fileCacheManager;
    private codebaseAnalyzer;
    constructor();
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
    invoke(param: Execution): Promise<Result[]>;
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
    private prepareCacheOnBranch;
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
    private removeOrphanedBranches;
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
    private detectErrorsForFile;
}
