import { Execution } from "../../data/model/execution";
import { Result } from "../../data/model/result";
import { ProjectRepository } from "../../data/repository/project_repository";
import { INPUT_KEYS } from "../../utils/constants";
import { logError, logInfo } from "../../utils/logger";
import { ParamUseCase } from "../base/param_usecase";


export class CreateTagUseCase  implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'CreateTagUseCase';
    
    private projectRepository = new ProjectRepository();

    async invoke(param: Execution): Promise<Result[]> {
        logInfo(`Executing ${this.taskId}.`);

        const result: Result[] = [];

        if (param.singleAction.version.length === 0) {
            logError(`Version is not set.`)
            result.push(
                new Result({
                    id: this.taskId,
                    success: false,
                    executed: true,
                    errors: [
                        `${INPUT_KEYS.SINGLE_ACTION_VERSION} is not set.`
                    ],
                })
            );
            return result;
        } else if (param.currentConfiguration.releaseBranch === undefined) {
            logError(`Working branch not found in configuration.`)
            result.push(
                new Result({
                    id: this.taskId,
                    success: false,
                    executed: true,
                    errors: [
                        `Release branch not found in issue configuration.`
                    ],
                })
            );
            return result;
        }

        try {
            const sha1Tag = await this.projectRepository.createTag(
                param.owner,
                param.repo,
                param.currentConfiguration.releaseBranch,
                param.singleAction.version,
                param.tokens.token,
            );
            if (sha1Tag) {
                result.push(
                    new Result({
                        id: this.taskId,
                        success: true,
                        executed: true,
                        steps: [`Tag ${param.singleAction.version} is ready: ${sha1Tag}`],
                    })
                );
            } else {
                result.push(
                    new Result({
                        id: this.taskId,
                        success: false,
                        executed: true,
                        errors: [
                            `Failed to create tag ${param.singleAction.version}.`
                        ],
                    })
                );
            }
        } catch (error) {
            logError(`Error executing ${this.taskId}: ${error}`);
            result.push(
                new Result({
                    id: this.taskId,
                    success: false,
                    executed: true,
                    steps: [`Failed to create tag ${param.singleAction.version}.`],
                    errors: [
                        JSON.stringify(error)
                    ],
                })
            );
        }
        return result;
    }
}