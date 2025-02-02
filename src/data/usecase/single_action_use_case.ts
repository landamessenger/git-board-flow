import {ParamUseCase} from "./base/param_usecase";
import {Execution} from "../model/execution";
import {Result} from "../model/result";
import * as core from '@actions/core';
import {DeployedActionUseCase} from "./actions/deployed_action_use_case";

export class SingleActionUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'SingleActionUseCase';

    async invoke(param: Execution): Promise<Result[]> {
        core.info(`Executing ${this.taskId}.`)

        const results: Result[] = []
        try {
            if (!param.singleAction.validSingleAction) {
                core.info(`Not a valid single action: ${param.singleAction.currentSingleAction}`);
                return results;
            }

            if (param.singleAction.isDeployedAction) {
                results.push(...await new DeployedActionUseCase().invoke(param));
            }
        } catch (error) {
            console.error(error);
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