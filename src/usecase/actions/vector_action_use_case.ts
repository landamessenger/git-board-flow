import { ChunkedFile } from '../../data/model/chunked_file';
import { ChunkedFileChunk } from '../../data/model/chunked_file_chunk';
import { Execution } from '../../data/model/execution';
import { Result } from '../../data/model/result';
import { DockerRepository } from '../../data/repository/docker_repository';
import { FileRepository } from '../../data/repository/file_repository';
import { SupabaseRepository } from '../../data/repository/supabase_repository';
import { logError, logInfo, logSingleLine } from '../../utils/logger';
import { ParamUseCase } from '../base/param_usecase';

export class VectorActionUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'VectorActionUseCase';
    private dockerRepository: DockerRepository = new DockerRepository();
    private fileRepository: FileRepository = new FileRepository();
    private readonly CODE_INSTRUCTION_BLOCK = "Represent the code for semantic search";
    private readonly CODE_INSTRUCTION_LINE = "Represent each line of code for retrieval";

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

            await this.dockerRepository.startContainer(param);

            const systemInfo = await this.dockerRepository.getSystemInfo(param);
            const chunkSize = systemInfo.parameters.chunk_size as number;
            const maxWorkers = systemInfo.parameters.max_workers as number;

            logInfo(`🧑‍🏭 Max workers: ${maxWorkers}`);
            logInfo(`🚚 Chunk size: ${chunkSize}`);
            logInfo(`📦 Getting chunks on ${param.owner}/${param.repo}/${branch}`);

            const chunkedFilesMap = await this.fileRepository.getChunkedRepositoryContent(
                param.owner,
                param.repo,
                branch,
                chunkSize,
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
        } finally {
            await this.dockerRepository.stopContainer(param);
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

        if (pathsToRemove.length > 0) {
            logInfo(`📦 Found ${pathsToRemove.length} paths to remove from AI index as they no longer exist in the branch ${branch}.`);
            
            for (const path of pathsToRemove) {
                try {
                    await supabaseRepository.removeChunksByPath(
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
        const processedChunkedFiles: ChunkedFile[] = [];
        const chunkedFiles = Array.from(chunkedFilesMap.values()).flat();
        const totalFiles = chunkedFiles.length;
        const startTime = Date.now();
        const chunkedPaths = Array.from(chunkedFilesMap.keys());
        
        for (let i = 0; i < chunkedPaths.length; i++) {
            const path = chunkedPaths[i];
            const chunkedFiles: ChunkedFile[] = chunkedFilesMap.get(path) || [];
            const progress = ((i + 1) / chunkedPaths.length) * 100;
            const currentTime = Date.now();
            const elapsedTime = (currentTime - startTime) / 1000; // in seconds
            const estimatedTotalTime = (elapsedTime / (i + 1)) * chunkedPaths.length;
            const remainingTime = estimatedTotalTime - elapsedTime;

            logSingleLine(`🔘 ${i + 1}/${chunkedPaths.length} (${progress.toFixed(1)}%) - Estimated time remaining: ${Math.ceil(remainingTime)} seconds | Checking [${path}]`);

            const remoteShasum = await supabaseRepository.getShasumByPath(
                param.owner,
                param.repo,
                branch,
                path
            );

            if (remoteShasum && remoteShasum === chunkedFiles[0].shasum) {
                logSingleLine(`🟢 ${i + 1}/${chunkedPaths.length} (${progress.toFixed(1)}%) - Estimated time remaining: ${Math.ceil(remainingTime)} seconds | File indexed [${path}]`);
                continue;
            } else if (remoteShasum && remoteShasum !== chunkedFiles[0].shasum) {
                logSingleLine(`🟡 ${i + 1}/${chunkedPaths.length} (${progress.toFixed(1)}%) - Estimated time remaining: ${Math.ceil(remainingTime)} seconds | File has changes and must be reindexed [${path}]`);
                await supabaseRepository.removeChunksByPath(
                    param.owner,
                    param.repo,
                    branch,
                    path
                );
            }

            for (let j = 0; j < chunkedFiles.length; j++) {
                const chunkedFile = chunkedFiles[j];
                const chunkProgress = ((j + 1) / chunkedFiles.length) * 100;
                const currentChunkTime = Date.now();
                const chunkElapsedTime = (currentChunkTime - startTime) / 1000;
                const estimatedChunkTotalTime = (chunkElapsedTime / ((i * chunkedFiles.length) + j + 1)) * totalFiles;
                const chunkRemainingTime = estimatedChunkTotalTime - chunkElapsedTime;
                
                logSingleLine(`🟡 ${i + 1}/${chunkedPaths.length} (${progress.toFixed(1)}%) - Chunk ${j + 1}/${chunkedFiles.length} (${chunkProgress.toFixed(1)}%) - Estimated time remaining: ${Math.ceil(chunkRemainingTime)} seconds | Vectorizing [${chunkedFile.path}]`);

                const embeddings = await this.dockerRepository.getEmbedding(
                    param,
                    chunkedFile.chunks.map(chunk => [chunkedFile.type === 'block' ? this.CODE_INSTRUCTION_BLOCK : this.CODE_INSTRUCTION_LINE, chunk])
                );
                chunkedFile.vector = embeddings;

                logSingleLine(`🟢 ${i + 1}/${chunkedPaths.length} (${progress.toFixed(1)}%) - Chunk ${j + 1}/${chunkedFiles.length} (${chunkProgress.toFixed(1)}%) - Estimated time remaining: ${Math.ceil(chunkRemainingTime)} seconds | Storing [${chunkedFile.path}]`);
                
                await supabaseRepository.setChunkedFile(
                    param.owner,
                    param.repo,
                    branch,
                    chunkedFile
                );

                processedChunkedFiles.push(chunkedFile);
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
            logInfo(`📦 -> 📦 Duplicating chunks from ${sourceBranch} to ${targetBranch} for ${param.owner}/${param.repo}.`);
            await supabaseRepository.duplicateChunksByBranch(
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
                        `📦 -> 📦 ✅ Duplicated chunks from ${sourceBranch} to ${targetBranch} for ${param.owner}/${param.repo}.`,
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
                        `📦 -> 📦 ❌ Error duplicating chunks from ${sourceBranch} to ${targetBranch}: ${JSON.stringify(error, null, 2)}`,
                    ],
                })
            );
        }

        return results;
    }
}
