import {ParamUseCase} from "../base/param_usecase";
import {Execution} from "../../model/execution";
import {Result} from "../../model/result";
import * as core from '@actions/core';
import { BranchRepository } from "../../repository/branch_repository";
import { IssueRepository } from "../../repository/issue_repository";
import { logError } from "../../utils/logger";

export class CheckChangesIssueSizeUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'CheckChangesIssueSizeUseCase';
    private branchRepository = new BranchRepository();
    private issueRepository = new IssueRepository();
    async invoke(param: Execution): Promise<Result[]> {
        core.info(`Executing ${this.taskId}.`)

        const result: Result[] = []
        try {
            if (param.currentConfiguration.parentBranch === undefined) {
                core.info(`Parent branch is undefined.`)
                return result;
            }

            const headBranch = param.commit.branch;
            const baseBranch = param.currentConfiguration.parentBranch;

            const { size, reason } = await this.branchRepository.getSizeCategoryAndReason(
                param.owner,
                param.repo,
                headBranch,
                baseBranch,
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
                    param.issueNumber,
                    labelNames,
                    param.tokens.token,
                )

                console.log(`Updated labels on issue #${param.issueNumber}:`, labelNames);

                result.push(
                    new Result({
                        id: this.taskId,
                        success: true,
                        executed: true,
                        steps: [
                            `${reason}, so the issue was resized to ${size}.`,
                        ],
                    })
                );
            }
        } catch (error) {
            logError(error);
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