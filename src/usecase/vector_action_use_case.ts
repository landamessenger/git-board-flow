import { Execution } from '../data/model/execution';
import { Result } from '../data/model/result';
import { DockerRepository } from '../data/repository/docker_repository';
import { logDebugInfo, logError } from '../utils/logger';
import { ParamUseCase } from './base/param_usecase';

export class VectorActionUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'VectorActionUseCase';
    private dockerRepository: DockerRepository = DockerRepository.getInstance();

    private readonly CODE_INSTRUCTION = "Represent the code for semantic search";

    async invoke(param: Execution): Promise<Result[]> {
        const results: Result[] = [];

        try {
            await this.dockerRepository.startContainer();


            const embeddings = await this.dockerRepository.getEmbedding(
                [
                    [this.CODE_INSTRUCTION, "function sum(a, b) { return a + b; }"]
                ]
            );

            logDebugInfo(`Embedding: ${embeddings}`);
            
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