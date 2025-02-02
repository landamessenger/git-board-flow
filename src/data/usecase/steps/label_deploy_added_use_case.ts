import {ParamUseCase} from "../base/param_usecase";
import {Execution} from "../../model/execution";
import {Result} from "../../model/result";
import * as core from '@actions/core';
import {BranchRepository} from "../../repository/branch_repository";
import {injectJsonAsMarkdownBlock} from "../../utils/content_utils";

export class DeployAddedUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'DeployAddedUseCase';
    private branchRepository = new BranchRepository();

    async invoke(param: Execution): Promise<Result[]> {
        core.info(`Executing ${this.taskId}.`)

        const result: Result[] = []
        try {
            if (param.issue.labeled && param.issue.labelAdded === param.labels.deploy) {
                core.info(`Deploying requested.`)
                if (param.release.active && param.release.branch !== undefined) {
                    const releaseUrl = `https://github.com/${param.owner}/${param.repo}/tree/${param.release.branch}`;
                    const parameters = {
                        version: param.release.version,
                        title: 'Demo Release Title',
                        changelog: 'Demo changelog',
                        issue: param.issue.number,
                    }
                    await this.branchRepository.executeWorkflow(
                        param.owner,
                        param.repo,
                        param.release.branch,
                        param.workflows.release,
                        parameters,
                        param.tokens.tokenPat,
                    )
                    result.push(
                        new Result({
                            id: this.taskId,
                            success: true,
                            executed: true,
                            steps: [
                                `Executed release workflow [**${param.workflows.release}**](https://github.com/${param.owner}/${param.repo}/actions/workflows/${param.workflows.release}) on [**${param.release.branch}**](${releaseUrl}).

${injectJsonAsMarkdownBlock('Workflow Parameters', parameters)}`
                            ]
                        })
                    )
                } else if (param.hotfix.active && param.hotfix.branch !== undefined) {
                    const hotfixUrl = `https://github.com/${param.owner}/${param.repo}/tree/${param.hotfix.branch}`;
                    const parameters = {
                        version: param.hotfix.version,
                        title: 'Demo Hotfix Title',
                        changelog: 'Demo hotfix changelog',
                        issue: param.issue.number,
                    }
                    await this.branchRepository.executeWorkflow(
                        param.owner,
                        param.repo,
                        param.hotfix.branch,
                        param.workflows.release,
                        parameters,
                        param.tokens.tokenPat,
                    )
                    result.push(
                        new Result({
                            id: this.taskId,
                            success: true,
                            executed: true,
                            steps: [
                                `Executed hotfix workflow [**${param.workflows.hotfix}**](https://github.com/${param.owner}/${param.repo}/actions/workflows/${param.workflows.hotfix}) on [**${param.hotfix.branch}**](${hotfixUrl}).

${injectJsonAsMarkdownBlock('Workflow Parameters', parameters)}\``
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
            console.error(error);
            result.push(
                new Result({
                    id: this.taskId,
                    success: false,
                    executed: true,
                    steps: [
                        `Tried to work with workflows, but there was a problem.`,
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