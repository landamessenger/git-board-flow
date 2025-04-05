import { Execution } from "../data/model/execution";
import { Result } from "../data/model/result";
import { logDebugInfo, logError, logInfo } from "../utils/logger";
import { DeployedActionUseCase } from "./actions/deployed_action_use_case";
import { ParamUseCase } from "./base/param_usecase";

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