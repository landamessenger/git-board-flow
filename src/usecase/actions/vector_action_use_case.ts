import { ChunkedFile } from '../../data/model/chunked_file';
import { ChunkedFileChunk } from '../../data/model/chunked_file_chunk';
import { Execution } from '../../data/model/execution';
import { Result } from '../../data/model/result';
import { DockerRepository } from '../../data/repository/docker_repository';
import { FileRepository } from '../../data/repository/file_repository';
import { SupabaseRepository } from '../../data/repository/supabase_repository';
import { logDebugInfo, logError, logInfo, logSingleLine } from '../../utils/logger';
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

            const supabaseRepository: SupabaseRepository = new SupabaseRepository(param.supabaseConfig);

            await this.dockerRepository.startContainer(param);

            const systemInfo = await this.dockerRepository.getSystemInfo(param);
            const chunkSize = systemInfo.parameters.chunk_size as number;
            const maxWorkers = systemInfo.parameters.max_workers as number;

            logInfo(`🧑‍🏭 Max workers: ${maxWorkers}`);
            logInfo(`🚚 Chunk size: ${chunkSize}`);
            logInfo(`📦 Getting chunked files for ${param.owner}/${param.repo}/${param.commit.branch}`);

            const chunkedFiles = await this.fileRepository.getChunkedRepositoryContent(
                param.owner,
                param.repo,
                param.commit.branch,
                chunkSize,
                param.tokens.token,
                param.ai.getAiIgnoreFiles(),
                (fileName: string) => {
                    logSingleLine(`Checking file ${fileName}`);
                }
            );
            
            logInfo(`📦 ✅ Chunked files: ${chunkedFiles.length}`, true);

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
                        param.commit.branch,
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
                        param.commit.branch,
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
                    param.commit.branch,
                    chunkedFile
                );

                processedChunkedFiles.push(chunkedFile);
            }

            const totalDurationSeconds = (Date.now() - startTime) / 1000;
            logInfo(`📦 🚀 All chunked files stored ${param.owner}/${param.repo}/${param.commit.branch}. Total duration: ${Math.ceil(totalDurationSeconds)} seconds`, true);
            
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
}
