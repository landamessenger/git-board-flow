import { Execution } from '../../data/model/execution';
import { Result } from '../../data/model/result';
import { FileRepository } from '../../data/repository/file_repository';
import { SupabaseRepository } from '../../data/repository/supabase_repository';
import { AiRepository } from '../../data/repository/ai_repository';
import { logError, logInfo, logSingleLine, logDebugInfo } from '../../utils/logger';
import { ParamUseCase } from '../base/param_usecase';
import { FileImportAnalyzer } from '../steps/common/services/file_import_analyzer';
import { FileCacheManager } from '../steps/common/services/file_cache_manager';
import { CodebaseAnalyzer } from '../steps/common/services/codebase_analyzer';
import { PROMPTS } from '../../utils/constants';

export class VectorActionUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'VectorActionUseCase';
    private fileRepository: FileRepository = new FileRepository();
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

            const branch = param.commit.branch || param.branches.main;
            let duplicationBranch: string | undefined = undefined;
            if (branch === param.branches.main && param.singleAction.isAiCacheLocalAction) {
                logInfo(`📦 AI cache from [${param.branches.main}] will be duplicated to [${param.branches.development}] for ${param.owner}/${param.repo}.`);
                duplicationBranch = param.branches.development;
            }

            logInfo(`📦 Getting repository files on ${param.owner}/${param.repo}/${branch}`);

            const repositoryFiles = await this.fileRepository.getRepositoryContent(
                param.owner,
                param.repo,
                param.tokens.token,
                branch,
                param.ai.getAiIgnoreFiles(),
                (fileName: string) => {
                    logSingleLine(`Checking file ${fileName}`);
                },
                (fileName: string) => {
                    logSingleLine(`Ignoring file ${fileName}`);
                }
            );
            
            logInfo(`📦 ✅ Files to index: ${repositoryFiles.size}`, true);

            results.push(...await this.checkAICacheInSupabase(param, branch, repositoryFiles));
            results.push(...await this.uploadAICacheToSupabase(param, branch, repositoryFiles));

            if (duplicationBranch) {
                results.push(...await this.duplicateAICacheToBranch(param, branch, duplicationBranch));
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

    private checkAICacheInSupabase = async (param: Execution, branch: string, repositoryFiles: Map<string, string>) => {
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

        const remotePaths = await supabaseRepository.getDistinctPaths(
            param.owner,
            param.repo,
            branch,
        );

        // Get all local paths from repository files
        const localPaths = new Set(Array.from(repositoryFiles.keys()));

        // Find paths that exist in Supabase but not in the current branch
        const pathsToRemove = remotePaths.filter(path => !localPaths.has(path));

        if (pathsToRemove.length > 0 && remotePaths.length > 0) {
            logInfo(`📦 Found ${pathsToRemove.length} paths to remove from AI index as they no longer exist in the branch ${branch}.`);
            
            for (const path of pathsToRemove) {
                try {
                    await supabaseRepository.removeAIFileCacheByPath(
                        param.owner,
                        param.repo,
                        branch,
                        path
                    );
                    logInfo(`📦 ✅ Removed AI cache for path: ${path}`);
                } catch (error) {
                    logError(`📦 ❌ Error removing AI cache for path ${path}: ${JSON.stringify(error, null, 2)}`);
                }
            }

            results.push(
                new Result({
                    id: this.taskId,
                    success: true,
                    executed: true,
                    steps: [
                        `Removed ${pathsToRemove.length} paths from AI index as they no longer exist in \`${branch}\`.`,
                    ],
                })
            );
        } else {
            results.push(
                new Result({
                    id: this.taskId,
                    success: true,
                    executed: true,
                })
            );
        }

        return results;
    }

    private uploadAICacheToSupabase = async (param: Execution, branch: string, repositoryFiles: Map<string, string>) => {
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
        const startTime = Date.now();
        const filePaths = Array.from(repositoryFiles.keys());
        
        // Step 1: Build relationship map once for all files
        logInfo(`📦 Building relationship map from repository files...`);
        const relationshipMaps = this.fileImportAnalyzer.buildRelationshipMap(repositoryFiles);
        const consumesMap = relationshipMaps.consumes;
        const consumedByMap = relationshipMaps.consumedBy;
        logInfo(`✅ Relationship map built for ${repositoryFiles.size} files`);
        
        for (let i = 0; i < filePaths.length; i++) {
            const filePath = filePaths[i];
            const fileContent = repositoryFiles.get(filePath) || '';
            const progress = ((i + 1) / filePaths.length) * 100;
            const currentTime = Date.now();
            const elapsedTime = (currentTime - startTime) / 1000; // in seconds
            const estimatedTotalTime = (elapsedTime / (i + 1)) * filePaths.length;
            const remainingTime = estimatedTotalTime - elapsedTime;

            logSingleLine(`🔘 ${i + 1}/${filePaths.length} (${progress.toFixed(1)}%) - Estimated time remaining: ${Math.ceil(remainingTime)} seconds | Checking [${filePath}]`);

            // Normalize path for consistent comparison
            const normalizedPath = filePath.replace(/^\.\//, '').replace(/\\/g, '/').trim();
            
            // Calculate SHA for comparison
            const currentSHA = this.fileCacheManager.calculateFileSHA(fileContent);
            
            const remoteShasum = await supabaseRepository.getShasumByPath(
                param.owner,
                param.repo,
                branch,
                normalizedPath
            );

            if (remoteShasum) {
                if (remoteShasum === currentSHA) {
                    logSingleLine(`🟢 ${i + 1}/${filePaths.length} (${progress.toFixed(1)}%) - Estimated time remaining: ${Math.ceil(remainingTime)} seconds | File indexed [${normalizedPath}]`);
                    continue;
                } else if (remoteShasum !== currentSHA) {
                    logSingleLine(`🟡 ${i + 1}/${filePaths.length} (${progress.toFixed(1)}%) - Estimated time remaining: ${Math.ceil(remainingTime)} seconds | File has changes and must be reindexed [${normalizedPath}]`);
                    await supabaseRepository.removeAIFileCacheByPath(
                        param.owner,
                        param.repo,
                        branch,
                        normalizedPath
                    );
                }
            } else {
                // File not in cache - will be processed below
                logSingleLine(`🟡 ${i + 1}/${filePaths.length} (${progress.toFixed(1)}%) - Estimated time remaining: ${Math.ceil(remainingTime)} seconds | File not in cache, will index [${normalizedPath}]`);
            }

            // Generate AI cache for this file
            if (fileContent) {
                
                try {
                    logSingleLine(`🟡 ${i + 1}/${filePaths.length} (${progress.toFixed(1)}%) - Estimated time remaining: ${Math.ceil(remainingTime)} seconds | Generating AI cache [${filePath}]`);
                    
                    // Step 2: Extract imports for this file (from pre-built map)
                    const consumes = consumesMap.get(filePath) || [];
                    const consumedBy = consumedByMap.get(filePath) || [];
                    
                    // Step 3: Generate description using AI (with fallback)
                    let description = this.codebaseAnalyzer.generateBasicDescription(filePath);
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
                    
                    // Step 4: Save to Supabase (normalize path before saving)
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
                    
                    logSingleLine(`🟢 ${i + 1}/${filePaths.length} (${progress.toFixed(1)}%) - Estimated time remaining: ${Math.ceil(remainingTime)} seconds | AI cache saved [${filePath}]`);
                    
                } catch (error) {
                    logError(`Error generating AI cache for ${filePath}: ${JSON.stringify(error, null, 2)}`);
                }
            }
        }

        const totalDurationSeconds = (Date.now() - startTime) / 1000;
        logInfo(`📦 🚀 All files stored in AI cache ${param.owner}/${param.repo}/${branch}. Total duration: ${Math.ceil(totalDurationSeconds)} seconds`, true);
        
        results.push(
            new Result({
                id: this.taskId,
                success: true,
                executed: true,
                steps: [
                    `All files up to date in AI cache for \`${branch}\`. Total duration: ${Math.ceil(totalDurationSeconds)} seconds`,
                ],
            })
        );
        return results;
    }

    private duplicateAICacheToBranch = async (param: Execution, sourceBranch: string, targetBranch: string) => {
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
            logInfo(`📦 -> 📦 Clearing possible existing AI cache from ${targetBranch} for ${param.owner}/${param.repo}.`);
            await supabaseRepository.removeAIFileCacheByBranch(
                param.owner,
                param.repo,
                targetBranch
            );
            
            logInfo(`📦 -> 📦 Duplicating AI cache from ${sourceBranch} to ${targetBranch} for ${param.owner}/${param.repo}.`);
            await supabaseRepository.duplicateAIFileCacheByBranch(
                param.owner,
                param.repo,
                sourceBranch,
                targetBranch
            );

            results.push(
                new Result({
                    id: this.taskId,
                    success: true,
                    executed: true,
                    steps: [
                        `Duplicated AI cache from ${sourceBranch} to ${targetBranch} for ${param.owner}/${param.repo}.`,
                    ],
                })
            );
        } catch (error) {
            logError(`📦 -> 📦 ❌ Error duplicating AI cache from ${sourceBranch} to ${targetBranch}: ${JSON.stringify(error, null, 2)}`);
            results.push(
                new Result({
                    id: this.taskId,
                    success: false,
                    executed: true,
                    errors: [
                        `Error duplicating AI cache from ${sourceBranch} to ${targetBranch}: ${JSON.stringify(error, null, 2)}`,
                    ],
                })
            );
        }

        return results;
    }

    // All methods related to file imports, cache, and codebase analysis
    // have been moved to dedicated services:
    // - FileImportAnalyzer: extractImportsFromFile, resolveRelativePath, buildRelationshipMap
    // - FileCacheManager: calculateFileSHA
    // - CodebaseAnalyzer: generateBasicDescription
}
