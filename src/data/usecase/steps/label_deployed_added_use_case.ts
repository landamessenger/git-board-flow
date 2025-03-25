import {ParamUseCase} from "../base/param_usecase";
import {Execution} from "../../model/execution";
import {Result} from "../../model/result";
import * as core from '@actions/core';
import { logError } from "../../utils/logger";

export class DeployedAddedUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'DeployedAddedUseCase';

    async invoke(param: Execution): Promise<Result[]> {
        core.info(`Executing ${this.taskId}.`)

        const result: Result[] = []
        try {
            if (param.issue.labeled && param.issue.labelAdded === param.labels.deployed) {
                core.info(`Deploy complete.`)
                if (param.release.active && param.release.branch !== undefined) {
                    const releaseUrl = `https://github.com/${param.owner}/${param.repo}/tree/${param.release.branch}`;
                    result.push(
                        new Result({
                            id: this.taskId,
                            success: true,
                            executed: true,
                            steps: [
                                `Deploy complete from [${param.release.branch}](${releaseUrl})`
                            ]
                        })
                    )
                } else if (param.hotfix.active && param.hotfix.branch !== undefined) {
                    const hotfixUrl = `https://github.com/${param.owner}/${param.repo}/tree/${param.hotfix.branch}`;
                    result.push(
                        new Result({
                            id: this.taskId,
                            success: true,
                            executed: true,
                            steps: [
                                `Deploy complete from [${param.hotfix.branch}](${hotfixUrl})`
                            ]
                        })
                    )
                }
            } else {
                result.push(
                    new Result({
                        id: this.taskId,
                        success: true,
                        executed: false,
                    })
                )
            }
        } catch (error) {
            logError(error);
            result.push(
                new Result({
                    id: this.taskId,
                    success: false,
                    executed: true,
                    steps: [
                        `Tried to complete the deployment, but there was a problem.`,
                    ],
                    errors: [
                        error?.toString() ?? 'Unknown error',
                    ],
                })
            )
        }
        return result
    }
}