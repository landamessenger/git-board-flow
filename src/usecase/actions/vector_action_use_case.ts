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
                duplicationBranch = param.branches.development;
            }

            await this.dockerRepository.startContainer(param);

            const systemInfo = await this.dockerRepository.getSystemInfo(param);
            const chunkSize = systemInfo.parameters.chunk_size as number;
            const maxWorkers = systemInfo.parameters.max_workers as number;

            logInfo(`🧑‍🏭 Max workers: ${maxWorkers}`);
            logInfo(`🚚 Chunk size: ${chunkSize}`);
            logInfo(`📦 Getting chunked files for ${param.owner}/${param.repo}/${branch}`);

            const chunkedFiles = await this.fileRepository.getChunkedRepositoryContent(
                param.owner,
                param.repo,
                branch,
                chunkSize,
                param.tokens.token,
                param.ai.getAiIgnoreFiles(),
                (fileName: string) => {
                    logSingleLine(`Checking file ${fileName}`);
                }
            );
            
            logInfo(`📦 ✅ Chunked files: ${chunkedFiles.length}`, true);

            results.push(...await this.checkChunksInSupabase(param, branch, chunkedFiles));
            results.push(...await this.uploadChunksToSupabase(param, branch, chunkedFiles));

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

    private checkChunksInSupabase = async (param: Execution, branch: string, chunkedFiles: ChunkedFile[]) => {
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
        const localPaths = new Set(chunkedFiles.map(file => file.path));

        // Find paths that exist in Supabase but not in the current branch
        const pathsToRemove = remotePaths.filter(path => !localPaths.has(path));

        if (pathsToRemove.length > 0) {
            logInfo(`Found ${pathsToRemove.length} paths to remove from Supabase as they no longer exist in the current branch.`);
            
            for (const path of pathsToRemove) {
                try {
                    await supabaseRepository.removeChunksByPath(
                        param.owner,
                        param.repo,
                        branch,
                        path
                    );
                    logInfo(`Removed chunks for path: ${path}`);
                } catch (error) {
                    logError(`Error removing chunks for path ${path}: ${JSON.stringify(error, null, 2)}`);
                }
            }

            results.push(
                new Result({
                    id: this.taskId,
                    success: true,
                    executed: true,
                    steps: [
                        `Removed ${pathsToRemove.length} paths from Supabase that no longer exist in ${param.owner}/${param.repo}/${branch}.`,
                    ],
                })
            );
        } else {
            results.push(
                new Result({
                    id: this.taskId,
                    success: true,
                    executed: true,
                    steps: [
                        `No paths to remove from Supabase. All paths exist in the current branch.`,
                    ],
                })
            );
        }

        return results;
    }

    private uploadChunksToSupabase = async (param: Execution, branch: string, chunkedFiles: ChunkedFile[]) => {
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
        const totalFiles = chunkedFiles.length;
        const startTime = Date.now();
        
        for (let i = 0; i < chunkedFiles.length; i++) {
            const chunkedFile = chunkedFiles[i];
            const currentTime = Date.now();
            const elapsedTime = (currentTime - startTime) / 1000; // in seconds
            const progress = ((i + 1) / totalFiles) * 100;
            
            // Calculate estimated time remaining
            const estimatedTotalTime = (elapsedTime / (i + 1)) * totalFiles;
            const remainingTime = estimatedTotalTime - elapsedTime;
            
            logSingleLine(`🔘 ${i + 1}/${totalFiles} (${progress.toFixed(1)}%) - Estimated time remaining: ${Math.ceil(remainingTime)} seconds | Checking [${chunkedFile.path}]`);
            
            let remoteChunkedFiles: ChunkedFileChunk[];
            try {
                remoteChunkedFiles = await supabaseRepository.getChunksByShasum(
                    param.owner,
                    param.repo,
                    branch,
                    chunkedFile.shasum,
                );
            } catch (error) {
                logError(`Error checking file ${chunkedFile.path} in Supabase: ${JSON.stringify(error, null, 2)}`);
                remoteChunkedFiles = [];
            }

            if (remoteChunkedFiles.length > 0 && remoteChunkedFiles.length === chunkedFile.chunks.length) {
                processedChunkedFiles.push(chunkedFile);
                logInfo(`📦 ✅ Chunk already exists in Supabase: [${chunkedFile.path}] [${chunkedFile.index}]`, true);
                continue;
            } else if (remoteChunkedFiles.length > 0 && remoteChunkedFiles.length !== chunkedFile.chunks.length) {
                logInfo(`📦 ❌ Chunk has a different number of chunks in Supabase: [${chunkedFile.path}] [${chunkedFile.index}]`, true);
                await supabaseRepository.removeChunksByShasum(
                    param.owner,
                    param.repo,
                    branch,
                    chunkedFile.shasum,
                );
                logInfo(`📦 🗑️ Chunks removed from Supabase: [${chunkedFile.path}] [${chunkedFile.index}]`, true);
            }

            logSingleLine(`🟡 ${i + 1}/${totalFiles} (${progress.toFixed(1)}%) - Estimated time remaining: ${Math.ceil(remainingTime)} seconds | Vectorizing [${chunkedFile.path}]`);

            const embeddings = await this.dockerRepository.getEmbedding(
                param,
                chunkedFile.chunks.map(chunk => [chunkedFile.type === 'block' ? this.CODE_INSTRUCTION_BLOCK : this.CODE_INSTRUCTION_LINE, chunk])
            );
            chunkedFile.vector = embeddings;

            logSingleLine(`🟢 ${i + 1}/${totalFiles} (${progress.toFixed(1)}%) - Estimated time remaining: ${Math.ceil(remainingTime)} seconds | Storing [${chunkedFile.path}]`);
            
            await supabaseRepository.setChunkedFile(
                param.owner,
                param.repo,
                branch,
                chunkedFile
            );

            processedChunkedFiles.push(chunkedFile);
        }

        const totalDurationSeconds = (Date.now() - startTime) / 1000;
        logInfo(`📦 🚀 All chunked files stored ${param.owner}/${param.repo}/${branch}. Total duration: ${Math.ceil(totalDurationSeconds)} seconds`, true);
        
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
