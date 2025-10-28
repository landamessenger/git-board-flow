import { Execution } from '../../data/model/execution';
import { Result } from '../../data/model/result';
import { DockerRepository } from '../../data/repository/docker_repository';
import { logDebugInfo, logError, logInfo } from '../../utils/logger';
import { ParamUseCase } from '../base/param_usecase';

export class PrepareAIContainerUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'PrepareAIContainerUseCase';
    private dockerRepository: DockerRepository = new DockerRepository();

    async invoke(param: Execution): Promise<Result[]> {
        logInfo(`Executing ${this.taskId}.`);

        const results: Result[] = [];

        try {
            // Check if image already exists in registry
            const imageExistsInRegistry = await this.dockerRepository.checkImageInRegistry(param);
            
            if (imageExistsInRegistry) {
                logInfo('🐳 🟢 AI container image already exists in registry, skipping build');
                results.push(
                    new Result({
                        id: this.taskId,
                        success: true,
                        executed: true,
                        steps: [
                            `AI container image already exists in registry: ${this.dockerRepository.getImageName(param)}`,
                        ],
                    })
                );
                return results;
            }

            // Build and push image to registry
            logInfo('🐳 🟡 AI container image not found in registry, building and pushing...');
            await this.buildAndPushImage(param);

            results.push(
                new Result({
                    id: this.taskId,
                    success: true,
                    executed: true,
                    steps: [
                        `AI container image built and pushed to registry: ${this.dockerRepository.getImageName(param)}`,
                    ],
                })
            );

        } catch (error) {
            logError(`Error in ${this.taskId}: ${error}`);
            results.push(
                new Result({
                    id: this.taskId,
                    success: false,
                    executed: true,
                    steps: [
                        `Error preparing AI container: ${error}`,
                    ],
                })
            );
        }

        return results;
    }

    private async buildAndPushImage(param: Execution): Promise<void> {
        try {
            const imageName = this.dockerRepository.getImageName(param);
            logInfo(`🐳 🟡 Building AI container image: ${imageName}`);
            
            // Build the image
            const imageExists = await this.dockerRepository.imageExists(param);
            if (!imageExists) {
                logDebugInfo('🐳 🟡 Local image not found, building...');
                await this.dockerRepository.buildImage(param);
            } else {
                logDebugInfo('🐳 🟢 Local image already exists, skipping build');
            }
            
            // Push to registry
            logInfo(`🐳 🟡 Pushing AI container image to registry: ${imageName}`);
            await this.dockerRepository.pushImageToRegistry(param, imageName);
            
            logInfo(`🐳 🟢 AI container image successfully built and pushed: ${imageName}`);
        } catch (error) {
            logError(`Error building and pushing AI container image: ${error}`);
            throw error;
        }
    }
}
