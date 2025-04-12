import { Execution } from '../data/model/execution';
import { Result } from '../data/model/result';
import { DockerRepository } from '../data/repository/docker_repository';
import { logDebugInfo, logError } from '../utils/logger';
import { ParamUseCase } from './base/param_usecase';

export class VectorActionUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'VectorActionUseCase';
    private dockerRepository: DockerRepository = DockerRepository.getInstance();

    async invoke(param: Execution): Promise<Result[]> {
        const results: Result[] = [];

        try {
            // Start the container and wait for it to be ready
            logDebugInfo('🐳 🟡 Starting Docker container...');
            await this.dockerRepository.startContainer();
            logDebugInfo('🐳 🟢 Docker container is ready');

            // Here should be the logic to interact with the container
            // For example, making API calls to the FastAPI service
            // const response = await fetch('http://localhost:8000/your-endpoint');
            // const data = await response.json();
            // results.push(data);

            // For now, we'll just add a success message
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
            logError('🐳 🔴 Error in VectorActionUseCase: ' + error);
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
            // Always stop the container when we're done
            try {
                logDebugInfo('🐳 🟢 Stopping Docker container...');
                await this.dockerRepository.stopContainer();
                logDebugInfo('🐳 ⚪ Docker container stopped');
            } catch (error) {
                logError('🐳 🔴 Error stopping container: ' + error);
            }
        }

        return results;
    }
} 