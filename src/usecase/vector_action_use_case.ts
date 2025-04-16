import { ChunkedFile } from '../data/model/chunked_file';
import { Execution } from '../data/model/execution';
import { Result } from '../data/model/result';
import { DockerRepository } from '../data/repository/docker_repository';
import { FileRepository } from '../data/repository/file_repository';
import { SupabaseRepository } from '../data/repository/supabase_repository';
import { logDebugInfo, logError, logSingleLine } from '../utils/logger';
import { ParamUseCase } from './base/param_usecase';

export class VectorActionUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'VectorActionUseCase';
    private dockerRepository: DockerRepository = new DockerRepository();
    private fileRepository: FileRepository = new FileRepository();
    private readonly CODE_INSTRUCTION = "Represent the code for semantic search";

    async invoke(param: Execution): Promise<Result[]> {
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
            logDebugInfo(`System info: ${JSON.stringify(systemInfo, null, 2)}`);
            const chunkSize = systemInfo.parameters.chunk_size as number;
            const maxWorkers = systemInfo.parameters.max_workers as number;

            logDebugInfo(`Getting chunked files for ${param.repo} ${param.commit.branch}`);

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
            
            logDebugInfo(`Chunked files: ${chunkedFiles.length}`);

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
                
                logSingleLine(`${i + 1}/${totalFiles} (${progress.toFixed(1)}%) - Estimated time remaining: ${Math.ceil(remainingTime)} seconds | Checking [${chunkedFile.path}]`);
                
                const remoteChunkedFile = await supabaseRepository.getChunkedFile(
                    param.owner,
                    param.repo,
                    param.commit.branch,
                    chunkedFile.shasum
                );

                if (remoteChunkedFile && remoteChunkedFile.vector.length > 0) {
                    processedChunkedFiles.push(chunkedFile);
                    continue;
                }

                logSingleLine(`${i + 1}/${totalFiles} (${progress.toFixed(1)}%) - Estimated time remaining: ${Math.ceil(remainingTime)} seconds | Vectorizing [${chunkedFile.path}]`);

                const embeddings = await this.dockerRepository.getEmbedding(
                    param,
                    chunkedFile.chunks.map(chunk => [this.CODE_INSTRUCTION, chunk])
                );
                chunkedFile.vector = embeddings;

                logSingleLine(`${i + 1}/${totalFiles} (${progress.toFixed(1)}%) - Estimated time remaining: ${Math.ceil(remainingTime)} seconds | Storing [${chunkedFile.path}]`);
                
                await supabaseRepository.setChunkedFile(
                    param.owner,
                    param.repo,
                    param.commit.branch,
                    chunkedFile
                );

                processedChunkedFiles.push(chunkedFile);
            }

            const totalDurationSeconds = (Date.now() - startTime) / 1000;
            logDebugInfo(`All chunked files stored ${param.owner}/${param.repo}/${param.commit.branch}. Total duration: ${Math.ceil(totalDurationSeconds)} seconds`);
            
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
            logError('Error in VectorActionUseCase: ' + JSON.stringify(error, null, 2));
            results.push(
                new Result({
                    id: this.taskId,
                    success: false,
                    executed: true,
                    steps: [
                        `Error in VectorActionUseCase: ${JSON.stringify(error, null, 2)}`,
                    ],
                })
            );
        } finally {
            await this.dockerRepository.stopContainer(param);
        }

        return results;
    }
} 