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

            for (const branch of branchesToProcess) {
                results.push(...await this.prepareCacheOnBranch(param, branch));
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

    private prepareCacheOnBranch = async (param: Execution, branch: string) => {
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
            return results;
        }

        const supabaseRepository: SupabaseRepository = new SupabaseRepository(param.supabaseConfig);

        try {
            logDebugInfo(`📦 Processing AI cache for branch ${branch} for ${param.owner}/${param.repo}.`, true);
            
            const repositoryFiles = await this.fileRepository.getRepositoryContent(
                param.owner,
                param.repo,
                param.tokens.token,
                branch,
                param.ai.getAiIgnoreFiles(),
                (fileName: string) => {
                    // logSingleLine(`Checking file ${fileName}`);
                },
                (fileName: string) => {
                    // logSingleLine(`Ignoring file ${fileName}`);
                }
            );
            
            logSingleLine(`📦 ✅ Files to process: ${repositoryFiles.size}`);

            if (repositoryFiles.size === 0) {
                logSingleLine(`📦 No files found in branch ${branch}, nothing to process.`);
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
                return results;
            }

            const startTime = Date.now();
            const filePaths = Array.from(repositoryFiles.keys());
            
            // Step 1: Build relationship map once for all files
            logSingleLine(`📦 Building relationship map from repository files...`);
            const relationshipMaps = this.fileImportAnalyzer.buildRelationshipMap(repositoryFiles);
            const consumesMap = relationshipMaps.consumes;
            const consumedByMap = relationshipMaps.consumedBy;
            logSingleLine(`✅ Relationship map built for ${repositoryFiles.size} files`);
            
            let filesProcessed = 0;
            let filesReused = 0;
            let filesSkipped = 0;
            let filesGenerated = 0;

            // Process each file
            for (let i = 0; i < filePaths.length; i++) {
                const filePath = filePaths[i];
                const fileContent = repositoryFiles.get(filePath) || '';
                const progress = ((i + 1) / filePaths.length) * 100;
                const currentTime = Date.now();
                const elapsedTime = (currentTime - startTime) / 1000; // in seconds
                const estimatedTotalTime = (elapsedTime / (i + 1)) * filePaths.length;
                const remainingTime = estimatedTotalTime - elapsedTime;

                logSingleLine(`🔘 ${i + 1}/${filePaths.length} (${progress.toFixed(1)}%) - Estimated time remaining: ${Math.ceil(remainingTime)} seconds | Processing [${filePath}]`);

                // Normalize path for consistent comparison
                const normalizedPath = filePath.replace(/^\.\//, '').replace(/\\/g, '/').trim();
                
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
                    logSingleLine(`🟢 ${i + 1}/${filePaths.length} (${progress.toFixed(1)}%) - File already indexed [${normalizedPath}]`);
                    filesSkipped++;
                    continue;
                }

                // Check if this SHA exists in any branch (to reuse description)
                const existingCache = await supabaseRepository.getAIFileCacheBySha(
                    param.owner,
                    param.repo,
                    currentSHA
                );

                // Extract imports for this file (from pre-built map)
                const consumes = consumesMap.get(filePath) || [];
                const consumedBy = consumedByMap.get(filePath) || [];
                
                let description: string;
                
                if (existingCache) {
                    // Reuse description from existing cache
                    description = existingCache.description;
                    filesReused++;
                    logSingleLine(`🟡 ${i + 1}/${filePaths.length} (${progress.toFixed(1)}%) - Reusing description from cache [${normalizedPath}]`);
                } else {
                    // Generate new description using AI
                    filesGenerated++;
                    logSingleLine(`🟡 ${i + 1}/${filePaths.length} (${progress.toFixed(1)}%) - Generating AI description [${normalizedPath}]`);
                    
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
                    const fileName = filePath.split('/').pop() || filePath;
                    const normalizedFilePath = filePath.replace(/^\.\//, '').replace(/\\/g, '/').trim();
                    const normalizedConsumes = consumes.map(p => p.replace(/^\.\//, '').replace(/\\/g, '/').trim());
                    const normalizedConsumedBy = consumedBy.map(p => p.replace(/^\.\//, '').replace(/\\/g, '/').trim());
                    
                    await supabaseRepository.setAIFileCache(
                        param.owner,
                        param.repo,
                        branch,
                        {
                            file_name: fileName,
                            path: normalizedFilePath,
                            sha: currentSHA,
                            description: description,
                            consumes: normalizedConsumes,
                            consumed_by: normalizedConsumedBy
                        }
                    );
                    
                    filesProcessed++;
                    logSingleLine(`🟢 ${i + 1}/${filePaths.length} (${progress.toFixed(1)}%) - AI cache saved [${normalizedPath}]`);
                } catch (error) {
                    logError(`Error saving AI cache for ${filePath}: ${JSON.stringify(error, null, 2)}`);
                }
            }

            // Step 2: Check for files that exist in Supabase but no longer exist in the repository
            logSingleLine(`📦 Checking for files to remove from AI cache (deleted files)...`);
            const remotePaths = await supabaseRepository.getDistinctPaths(
                param.owner,
                param.repo,
                branch,
            );

            // Normalize local paths for consistent comparison
            const localPaths = new Set<string>();
            for (const filePath of repositoryFiles.keys()) {
                const normalizedPath = filePath.replace(/^\.\//, '').replace(/\\/g, '/').trim();
                localPaths.add(normalizedPath);
            }

            // Find paths that exist in Supabase but not in the current branch
            const pathsToRemove = remotePaths.filter(path => !localPaths.has(path));

            let filesRemoved = 0;
            if (pathsToRemove.length > 0) {
                logSingleLine(`📦 Found ${pathsToRemove.length} paths to remove from AI index as they no longer exist in the branch ${branch}.`);
                
                for (const path of pathsToRemove) {
                    try {
                        await supabaseRepository.removeAIFileCacheByPath(
                            param.owner,
                            param.repo,
                            branch,
                            path
                        );
                        filesRemoved++;
                        logSingleLine(`📦 ✅ Removed AI cache for deleted path: ${path}`);
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
            } else {
                logSingleLine(`📦 No files to remove from AI cache.`);
            }

            const totalDurationSeconds = (Date.now() - startTime) / 1000;
            logInfo(`📦 ✅ Processing complete for ${branch}: ${filesProcessed} processed, ${filesReused} reused, ${filesSkipped} skipped, ${filesGenerated} generated, ${filesRemoved} removed. Total duration: ${Math.ceil(totalDurationSeconds)} seconds`, true);

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

        return results;
    }
}
