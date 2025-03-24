import {ParamUseCase} from "../base/param_usecase";
import {Execution} from "../../model/execution";
import {Result} from "../../model/result";
import * as core from '@actions/core';
import { BranchRepository } from "../../repository/branch_repository";
import { IssueRepository } from "../../repository/issue_repository";

export class CheckChangesPullRequestSizeUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'CheckChangesPullRequestSizeUseCase';
    private branchRepository = new BranchRepository();
    private issueRepository = new IssueRepository();
    async invoke(param: Execution): Promise<Result[]> {
        core.info(`Executing ${this.taskId}.`)

        const result: Result[] = []
        try {
            const { size, reason } = await this.branchRepository.getSizeCategoryAndReason(
                param.owner,
                param.repo,
                param.pullRequest.head,
                param.pullRequest.base,
                param.sizeThresholds,
                param.labels,
                param.tokens.tokenPat,
            )

            if (param.labels.sizedLabel !== size) {
                const labelNames = param.labels.currentIssueLabels.filter(name => name !== param.labels.sizedLabel);
                labelNames.push(size);

                await this.issueRepository.setLabels(
                    param.owner,
                    param.repo,
                    param.pullRequest.number,
                    labelNames,
                    param.tokens.token,
                )

                console.log(`Updated labels on pull request #${param.pullRequest.number}:`, labelNames);

                result.push(
                    new Result({
                        id: this.taskId,
                        success: true,
                        executed: true,
                        steps: [
                            `${reason}, so the pull request was resized to ${size}.`,
                        ],
                    })
                );
            }
        } catch (error) {
            console.error(error);
            result.push(
                new Result({
                    id: this.taskId,
                    success: false,
                    executed: true,
                    steps: [
                        `Tried to check the size of the changes, but there was a problem.`,
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