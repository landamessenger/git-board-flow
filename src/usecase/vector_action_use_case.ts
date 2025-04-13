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

            const chunkedFiles = await this.fileRepository.getChunkedRepositoryContent(
                param.owner,
                param.repo,
                param.commit.branch,
                32,
                param.tokens.token
            );
            

            const processedChunkedFiles: ChunkedFile[] = [];
            for (const chunkedFile of chunkedFiles) {
                const embeddings = await this.dockerRepository.getEmbedding(
                    chunkedFile.chunks.map(chunk => [this.CODE_INSTRUCTION, chunk])
                );
                chunkedFile.vector = embeddings;
                processedChunkedFiles.push(chunkedFile);
            }

            logDebugInfo(`Setting all chunked files to firestore for ${param.repo} ${param.commit.branch}`);

            await firestoreRepository.setAllChunkedFiles(
                param.repo,
                param.commit.branch,
                processedChunkedFiles
            );

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