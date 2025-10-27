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
            const imageExistsInRegistry = await this.checkImageInRegistry(param);
            
            if (imageExistsInRegistry) {
                logInfo('🐳 🟢 AI container image already exists in registry, skipping build');
                results.push(
                    new Result({
                        id: this.taskId,
                        success: true,
                        executed: true,
                        steps: [
                            `AI container image already exists in registry: ${this.getImageName(param)}`,
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
                        `AI container image built and pushed to registry: ${this.getImageName(param)}`,
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

    private getImageName(param: Execution): string {
        const archType = this.dockerRepository.getArchitectureType();
        return `${param.owner}/${param.repo}/manager-${archType}-ai:latest`;
    }

    private async checkImageInRegistry(param: Execution): Promise<boolean> {
        try {
            const imageName = this.getImageName(param);
            logDebugInfo(`🐳 🟡 Checking if image exists in registry: ${imageName}`);
            
            // Try to pull the image to check if it exists
            const exists = await this.dockerRepository.checkImageInRegistry(imageName);
            return exists;
        } catch (error) {
            logDebugInfo(`🐳 🟡 Image not found in registry: ${error}`);
            return false;
        }
    }

    private async buildAndPushImage(param: Execution): Promise<void> {
        try {
            const imageName = this.getImageName(param);
            logInfo(`🐳 🟡 Building AI container image: ${imageName}`);
            
            // Build the image
            await this.dockerRepository.buildImage(param, imageName);
            
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
