import { ChunkedFile } from '../../data/model/chunked_file';
import { Execution } from '../../data/model/execution';
import { Result } from '../../data/model/result';
import { FileRepository } from '../../data/repository/file_repository';
import { SupabaseRepository } from '../../data/repository/supabase_repository';
import { AiRepository } from '../../data/repository/ai_repository';
import { logError, logInfo, logSingleLine } from '../../utils/logger';
import { ParamUseCase } from '../base/param_usecase';
import { FileImportAnalyzer } from '../steps/common/services/file_import_analyzer';
import { FileCacheManager } from '../steps/common/services/file_cache_manager';
import { CodebaseAnalyzer } from '../steps/common/services/codebase_analyzer';

export class VectorActionUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'VectorActionUseCase';
    private fileRepository: FileRepository = new FileRepository();
    private aiRepository: AiRepository = new AiRepository();
    private fileImportAnalyzer: FileImportAnalyzer = new FileImportAnalyzer();
    private fileCacheManager: FileCacheManager = new FileCacheManager();
    private codebaseAnalyzer: CodebaseAnalyzer;
    private readonly CODE_INSTRUCTION_BLOCK = "Represent the code for semantic search";
    private readonly CODE_INSTRUCTION_LINE = "Represent each line of code for retrieval";
    
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

            const branch = param.commit.branch || param.branches.main;
            let duplicationBranch: string | undefined = undefined;
            if (branch === param.branches.main && param.singleAction.isVectorLocalAction) {
                logInfo(`📦 Chunks from [${param.branches.main}] will be duplicated to [${param.branches.development}] for ${param.owner}/${param.repo}.`);
                duplicationBranch = param.branches.development;
            }

            logInfo(`📦 Getting chunks on ${param.owner}/${param.repo}/${branch}`);

            const chunkedFilesMap = await this.fileRepository.getChunkedRepositoryContent(
                param.owner,
                param.repo,
                branch,
                -1,
                param.tokens.token,
                param.ai.getAiIgnoreFiles(),
                (fileName: string) => {
                    logSingleLine(`Checking file ${fileName}`);
                },
                (fileName: string) => {
                    logSingleLine(`Ignoring file ${fileName}`);
                }
            );
            
            logInfo(`📦 ✅ Files to index: ${chunkedFilesMap.size}`, true);

            results.push(...await this.checkChunksInSupabase(param, branch, chunkedFilesMap));
            results.push(...await this.uploadChunksToSupabase(param, branch, chunkedFilesMap));

            if (duplicationBranch) {
                results.push(...await this.duplicateChunksToBranch(param, branch, duplicationBranch));
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

    private checkChunksInSupabase = async (param: Execution, branch: string, chunkedFilesMap: Map<string, ChunkedFile[]>) => {
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

        // Get all local paths from chunkedFiles
        const localPaths = new Set(Array.from(chunkedFilesMap.keys()));

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
                    logInfo(`📦 ✅ Removed chunks for path: ${path}`);
                } catch (error) {
                    logError(`📦 ❌ Error removing chunks for path ${path}: ${JSON.stringify(error, null, 2)}`);
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

    private uploadChunksToSupabase = async (param: Execution, branch: string, chunkedFilesMap: Map<string, ChunkedFile[]>) => {
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
        const chunkedPaths = Array.from(chunkedFilesMap.keys());
        
        // Step 1: Get all repository files once to build relationship map
        logInfo(`📦 Building relationship map from repository files...`);
        const allRepositoryFiles = await this.fileRepository.getRepositoryContent(
            param.owner,
            param.repo,
            param.tokens.token,
            branch,
            param.ai.getAiIgnoreFiles(),
            () => {}, // progress callback
            () => {}  // ignored files callback
        );
        
        // Step 2: Build relationship map once for all files
        const relationshipMaps = this.fileImportAnalyzer.buildRelationshipMap(allRepositoryFiles);
        const consumesMap = relationshipMaps.consumes;
        const consumedByMap = relationshipMaps.consumedBy;
        logInfo(`✅ Relationship map built for ${allRepositoryFiles.size} files`);
        
        for (let i = 0; i < chunkedPaths.length; i++) {
            const path = chunkedPaths[i];
            const chunkedFiles: ChunkedFile[] = chunkedFilesMap.get(path) || [];
            const progress = ((i + 1) / chunkedPaths.length) * 100;
            const currentTime = Date.now();
            const elapsedTime = (currentTime - startTime) / 1000; // in seconds
            const estimatedTotalTime = (elapsedTime / (i + 1)) * chunkedPaths.length;
            const remainingTime = estimatedTotalTime - elapsedTime;

            logSingleLine(`🔘 ${i + 1}/${chunkedPaths.length} (${progress.toFixed(1)}%) - Estimated time remaining: ${Math.ceil(remainingTime)} seconds | Checking [${path}]`);

            // Normalize path for consistent comparison
            const normalizedPath = path.replace(/^\.\//, '').replace(/\\/g, '/').trim();
            
            const remoteShasum = await supabaseRepository.getShasumByPath(
                param.owner,
                param.repo,
                branch,
                normalizedPath
            );

            if (remoteShasum) {
                if (remoteShasum === chunkedFiles[0].shasum) {
                    logSingleLine(`🟢 ${i + 1}/${chunkedPaths.length} (${progress.toFixed(1)}%) - Estimated time remaining: ${Math.ceil(remainingTime)} seconds | File indexed [${normalizedPath}]`);
                    continue;
                } else if (remoteShasum !== chunkedFiles[0].shasum) {
                    logSingleLine(`🟡 ${i + 1}/${chunkedPaths.length} (${progress.toFixed(1)}%) - Estimated time remaining: ${Math.ceil(remainingTime)} seconds | File has changes and must be reindexed [${normalizedPath}]`);
                    await supabaseRepository.removeAIFileCacheByPath(
                        param.owner,
                        param.repo,
                        branch,
                        normalizedPath
                    );
                }
            } else {
                // File not in cache - will be processed below
                logSingleLine(`🟡 ${i + 1}/${chunkedPaths.length} (${progress.toFixed(1)}%) - Estimated time remaining: ${Math.ceil(remainingTime)} seconds | File not in cache, will index [${normalizedPath}]`);
            }

            // Generate AI cache for this file (only process once per file, not per chunk)
            // Use the first chunkedFile to get the full content
            if (chunkedFiles.length > 0) {
                const firstChunkedFile = chunkedFiles[0];
                const fileContent = firstChunkedFile.content;
                const filePath = firstChunkedFile.path;
                
                try {
                    logSingleLine(`🟡 ${i + 1}/${chunkedPaths.length} (${progress.toFixed(1)}%) - Estimated time remaining: ${Math.ceil(remainingTime)} seconds | Generating AI cache [${filePath}]`);
                    
                    // Step 3: Extract imports for this file (from pre-built map)
                    const consumes = consumesMap.get(filePath) || [];
                    const consumedBy = consumedByMap.get(filePath) || [];
                    
                    // Step 4: Calculate SHA
                    const currentSHA = this.fileCacheManager.calculateFileSHA(fileContent);
                    
                    // Step 5: Generate description using AI (with fallback)
                    let description = this.codebaseAnalyzer.generateBasicDescription(filePath);
                    try {
                        // Create schema for single file description
                        const FILE_DESCRIPTION_SCHEMA = {
                            "type": "object",
                            "description": "File description",
                            "properties": {
                                "description": {
                                    "type": "string",
                                    "description": "Brief description (4-5 sentences) of what the file does in English. You can use 1 or 2 sentences if the file is small."
                                }
                            },
                            "required": ["description"],
                            "additionalProperties": false
                        };
                        
                        const descriptionPrompt = `Analyze this code file and provide a brief description (1-2 sentences) of what it does:

\`\`\`
${fileContent}
\`\`\`

Provide only a concise description in English, focusing on the main functionality.`;
                        
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
                    
                    // Step 6: Save to Supabase (normalize path before saving)
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
                    
                    logSingleLine(`🟢 ${i + 1}/${chunkedPaths.length} (${progress.toFixed(1)}%) - Estimated time remaining: ${Math.ceil(remainingTime)} seconds | AI cache saved [${filePath}]`);
                    
                } catch (error) {
                    logError(`Error generating AI cache for ${path}: ${JSON.stringify(error, null, 2)}`);
                }
            }
        }

        const totalDurationSeconds = (Date.now() - startTime) / 1000;
        logInfo(`📦 🚀 All chunked files stored ${param.owner}/${param.repo}/${branch}. Total duration: ${Math.ceil(totalDurationSeconds)} seconds`, true);
        
        results.push(
            new Result({
                id: this.taskId,
                success: true,
                executed: true,
                steps: [
                    `All chunked files up to date in AI index for \`${branch}\`. Total duration: ${Math.ceil(totalDurationSeconds)} seconds`,
                ],
            })
        );
        return results;
    }

    private duplicateChunksToBranch = async (param: Execution, sourceBranch: string, targetBranch: string) => {
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
                        `Duplicated chunks from ${sourceBranch} to ${targetBranch} for ${param.owner}/${param.repo}.`,
                    ],
                })
            );
        } catch (error) {
            logError(`📦 -> 📦 ❌ Error duplicating chunks from ${sourceBranch} to ${targetBranch}: ${JSON.stringify(error, null, 2)}`);
            results.push(
                new Result({
                    id: this.taskId,
                    success: false,
                    executed: true,
                    errors: [
                        `Error duplicating chunks from ${sourceBranch} to ${targetBranch}: ${JSON.stringify(error, null, 2)}`,
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
