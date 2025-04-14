import { Execution } from '../data/model/execution';
import { Result } from '../data/model/result';
import { DockerRepository } from '../data/repository/docker_repository';
import { FileRepository } from '../data/repository/file_repository';
import { logDebugInfo, logError } from '../utils/logger';
import { ParamUseCase } from './base/param_usecase';
import { ChunkedFile } from '../data/model/chunked_file';
import { FirestoreRepository } from '../data/repository/firestore_repository';
export class VectorActionUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'VectorActionUseCase';
    private dockerRepository: DockerRepository = DockerRepository.getInstance();
    private fileRepository: FileRepository = new FileRepository();
    private readonly CODE_INSTRUCTION = "Represent the code for semantic search";

    async invoke(param: Execution): Promise<Result[]> {
        const results: Result[] = [];

        try {
            if (!param.firebaseConfig) {
                new Result({
                    id: this.taskId,
                    success: false,
                    executed: true,
                    steps: [
                        `Firestore config not found.`,
                    ],
                })
            }

            const firestoreRepository: FirestoreRepository = new FirestoreRepository(param.firebaseConfig);

            await this.dockerRepository.startContainer();

            const systemInfo = await this.dockerRepository.getSystemInfo();
            logDebugInfo(`System info: ${JSON.stringify(systemInfo, null, 2)}`);
            const chunkSize = systemInfo.parameters.chunk_size as number;
            const maxWorkers = systemInfo.parameters.max_workers as number;

            logDebugInfo(`Getting chunked files for ${param.repo} ${param.commit.branch}`);

            const chunkedFiles = await this.fileRepository.getChunkedRepositoryContent(
                param.owner,
                param.repo,
                param.commit.branch,
                chunkSize,
                param.tokens.token
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
                
                logDebugInfo(`Processing file ${i + 1}/${totalFiles} (${progress.toFixed(1)}%) - Estimated time remaining: ${Math.ceil(remainingTime)} seconds`);
                
                const remoteChunkedFiles = await firestoreRepository.getChunkedFiles(
                    param.repo,
                    param.commit.branch,
                    chunkedFile.shasum
                );

                if (remoteChunkedFiles.length > 0 && remoteChunkedFiles[0].vector.length > 0) {
                    processedChunkedFiles.push(chunkedFile);
                    continue;
                }

                const embeddings = await this.dockerRepository.getEmbedding(
                    chunkedFile.chunks.map(chunk => [this.CODE_INSTRUCTION, chunk])
                );
                chunkedFile.vector = embeddings;

                await firestoreRepository.setChunkedFile(
                    param.repo,
                    param.commit.branch,
                    chunkedFile
                );

                processedChunkedFiles.push(chunkedFile);
            }

            logDebugInfo(`All chunked files set to firestore for ${param.repo} ${param.commit.branch}`);
            
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
            logError('Error in VectorActionUseCase: ' + error);
            results.push(
                new Result({
                    id: this.taskId,
                    success: false,
                    executed: true,
                    steps: [
                        `Error in VectorActionUseCase: ${error}`,
                    ],
                })
            );
        } finally {
            await this.dockerRepository.stopContainer();
        }

        return results;
    }
} 