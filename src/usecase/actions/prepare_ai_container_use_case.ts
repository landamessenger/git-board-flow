import { Execution } from '../../data/model/execution';
import { Result } from '../../data/model/result';
import { DockerRepository } from '../../data/repository/docker_repository';
import { logDebugInfo, logError, logInfo } from '../../utils/logger';
import { ParamUseCase } from '../base/param_usecase';

export class PrepareAIContainerUseCase implements ParamUseCase<Execution, Result[]> {
    taskId = 'PrepareAIContainerUseCase';
    private dockerRepository = new DockerRepository();

    async invoke(param: Execution): Promise<Result[]> {
        logInfo(`Executing ${this.taskId}.`);
        const results: Result[] = [];

        try {
            const version = param.singleAction.version;
            if (version.length === 0) {
                logError(`No version specified, skipping version check`);
                results.push(new Result({
                    id: this.taskId,
                    success: false,
                    executed: true,
                    steps: [`No version specified, skipping build`],
                }));
                return results;
            }

            const imageName = this.dockerRepository.getImageNameWithTag(param);
            
            logInfo(`🐳 🟡 Checking if v${version} already exists in registry...`);
            logInfo(`🐳 🟡 Image: ${imageName}`);
            
            const versionExists = await this.dockerRepository.checkVersionExistsInRegistry(param);
            
            if (versionExists) {
                logInfo(`🐳 🟢 v${version} already exists in registry, skipping build`);
                results.push(new Result({
                    id: this.taskId,
                    success: true,
                    executed: true,
                    steps: [`v${version} already exists in registry: ${imageName}`],
                }));
                return results;
            } else {
                logInfo(`🐳 🟡 v${version} not found in registry, proceeding with build...`);
            }

            logInfo('🐳 🟡 Building and pushing new image...');
            await this.dockerRepository.buildImage(param);

            results.push(new Result({
                id: this.taskId,
                success: true,
                executed: true,
                steps: [`Image built and pushed successfully: ${this.dockerRepository.getImageName(param)}`],
            }));
        } catch (error) {
            logError(`Error in ${this.taskId}: ${error}`);
            results.push(new Result({
                id: this.taskId,
                success: false,
                executed: true,
                steps: [`Error preparing AI container: ${error}`],
            }));
        }

        return results;
    }

    /*private async buildAndPushImage(param: Execution): Promise<void> {
        const imageName = this.dockerRepository.getImageName(param);

        const localExists = await this.dockerRepository.imageExists(param);
        if (!localExists) {
            logDebugInfo('🐳 🟡 Local image not found, building...');
            await this.dockerRepository.buildImage(param);
        } else {
            logDebugInfo('🐳 🟢 Local image already exists, skipping build');
        }

        logInfo('🐳 🟡 Pushing image to registry...');
        // await this.dockerRepository.pushImageToRegistry(param, imageName);
    }*/
}
