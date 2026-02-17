import { Execution } from "../../data/model/execution";
import { Result } from "../../data/model/result";
import { ProjectRepository } from "../../data/repository/project_repository";
import { INPUT_KEYS } from "../../utils/constants";
import { logError, logInfo, logWarn } from "../../utils/logger";
import { getTaskEmoji } from "../../utils/task_emoji";
import { ParamUseCase } from "../base/param_usecase";


export class CreateReleaseUseCase  implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'CreateReleaseUseCase';
    
    private projectRepository = new ProjectRepository();

    async invoke(param: Execution): Promise<Result[]> {
        logInfo(`${getTaskEmoji(this.taskId)} Executing ${this.taskId}.`);

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
        } else if (param.singleAction.title.length === 0) {
            logError(`Title is not set.`)
            result.push(
                new Result({
                    id: this.taskId,
                    success: false,
                    executed: true,
                    errors: [
                        `${INPUT_KEYS.SINGLE_ACTION_TITLE} is not set.`
                    ],
                })
            );
        } else if (param.singleAction.changelog.length === 0) {
            logError(`Changelog is not set.`)
            result.push(
                new Result({
                    id: this.taskId,
                    success: false,
                    executed: true,
                    errors: [
                        `${INPUT_KEYS.SINGLE_ACTION_CHANGELOG} is not set.`
                    ],
                })
            );
        }

        try {
            const releaseUrl = await this.projectRepository.createRelease(
                param.owner,
                param.repo,
                param.singleAction.version,
                param.singleAction.title,
                param.singleAction.changelog,
                param.tokens.token,
            );
            if (releaseUrl) {
                result.push(
                    new Result({
                        id: this.taskId,
                        success: true,
                        executed: true,
                        steps: [`Created release \`${releaseUrl}\`.`],
                    })
                );
            } else {
                logWarn(`CreateRelease: createRelease returned no URL for version ${param.singleAction.version}.`);
                result.push(
                    new Result({
                        id: this.taskId,
                        success: false,
                        executed: true,
                        errors: [
                            `Failed to create release.`
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
                    steps: [`Failed to create release.`],
                    errors: [
                        JSON.stringify(error)
                    ],
                })
            );
        }
        return result;
    }
}