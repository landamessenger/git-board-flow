import { Execution } from "../data/model/execution";
import { Result } from "../data/model/result";
import { logDebugInfo, logError, logInfo } from "../utils/logger";
import { DeployedActionUseCase } from "./actions/deployed_action_use_case";
import { ParamUseCase } from "./base/param_usecase";
import { PublishGithubActionUseCase } from "./actions/publish_github_action_use_case";
import { CreateReleaseUseCase } from "./actions/create_release_use_case";
import { CreateTagUseCase } from "./actions/create_tag_use_case";
import { ThinkUseCase } from "./steps/common/think_use_case";
import { InitialSetupUseCase } from "./actions/initial_setup_use_case";
import { CheckProgressUseCase } from "./actions/check_progress_use_case";

export class SingleActionUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'SingleActionUseCase';

    async invoke(param: Execution): Promise<Result[]> {
        logInfo(`Executing ${this.taskId}.`)

        const results: Result[] = []
        try {
            if (!param.singleAction.validSingleAction) {
                logDebugInfo(`Not a valid single action: ${param.singleAction.currentSingleAction}`);
                return results;
            }

            if (param.singleAction.isDeployedAction) {
                results.push(...await new DeployedActionUseCase().invoke(param));
            } else if (param.singleAction.isPublishGithubAction) {
                results.push(...await new PublishGithubActionUseCase().invoke(param));
            } else if (param.singleAction.isCreateReleaseAction) {
                results.push(...await new CreateReleaseUseCase().invoke(param));
            } else if (param.singleAction.isCreateTagAction) {
                results.push(...await new CreateTagUseCase().invoke(param));
            } else if (param.singleAction.isThinkAction) {
                results.push(...await new ThinkUseCase().invoke(param));
            } else if (param.singleAction.isInitialSetupAction) {
                results.push(...await new InitialSetupUseCase().invoke(param));
            } else if (param.singleAction.isCheckProgressAction) {
                results.push(...await new CheckProgressUseCase().invoke(param));
            }
        } catch (error) {
            logError(error);
            results.push(
                new Result({
                    id: this.taskId,
                    success: false,
                    executed: true,
                    steps: [
                        `Error executing single action: ${param.singleAction.currentSingleAction}.`,
                    ],
                    error: error,
                })
            )
        }
        return results;
    }
}