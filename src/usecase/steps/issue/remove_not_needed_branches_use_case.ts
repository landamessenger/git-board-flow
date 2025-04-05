import * as core from "@actions/core";
import { Execution } from "../../../data/model/execution";
import { Result } from "../../../data/model/result";
import { BranchRepository } from "../../../data/repository/branch_repository";
import { logError, logInfo } from "../../../utils/logger";
import { ParamUseCase } from "../../base/param_usecase";

export class RemoveNotNeededBranchesUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'RemoveNotNeededBranchesUseCase';
    
    private branchRepository = new BranchRepository();

    async invoke(param: Execution): Promise<Result[]> {
        logInfo(`Executing ${this.taskId}.`)

        const result: Result[] = []
        try {
            const issueTitle: string = param.issue.title;
            if (issueTitle.length === 0) {
                core.setFailed('Issue title not available.');

                result.push(
                    new Result({
                        id: this.taskId,
                        success: true,
                        executed: true,
                        steps: [
                            `Tried to remove not needed branches related to the issue, but the issue title was not found.`,
                        ],
                    })
                )

                return result;
            }
            const sanitizedTitle = this.branchRepository.formatBranchName(issueTitle, param.issueNumber)

            const branches = await this.branchRepository.getListOfBranches(
                param.owner,
                param.repo,
                param.tokens.githubToken,
            );

            const finalBranch = `${param.managementBranch}/${param.issueNumber}-${sanitizedTitle}`;

            const branchTypes = [param.branches.featureTree, param.branches.bugfixTree];
            for (const type of branchTypes) {
                let branchName = `${type}/${param.issueNumber}-${sanitizedTitle}`;
                const prefix = `${type}/${param.issueNumber}-`;

                if (type !== param.managementBranch) {
                    const matchingBranch = branches.find(branch => branch.indexOf(prefix) > -1);
                    if (!matchingBranch) {
                        continue;
                    }

                    branchName = matchingBranch;
                    const removed = await this.branchRepository.removeBranch(
                        param.owner,
                        param.repo,
                        branchName,
                        param.tokens.githubToken,
                    )
                    if (removed) {
                        result.push(
                            new Result({
                                id: this.taskId,
                                success: true,
                                executed: true,
                                steps: [
                                    `The branch \`${branchName}\` was removed.`,
                                ],
                            })
                        )
                    } else {
                        logError(`Error deleting ${branchName}`);
                        result.push(
                            new Result({
                                id: this.taskId,
                                success: false,
                                executed: true,
                                steps: [
                                    `Tried to remove not needed branch \`${branchName}\`, but there was a problem.`,
                                ],
                            })
                        )
                    }
                } else {
                    for (const branch of branches) {
                        if (branch.indexOf(prefix) > -1 && branch !== finalBranch) {
                            const removed = await this.branchRepository.removeBranch(
                                param.owner,
                                param.repo,
                                branch,
                                param.tokens.githubToken,
                            )
                            if (removed) {
                                result.push(
                                    new Result({
                                        id: this.taskId,
                                        success: true,
                                        executed: true,
                                        steps: [
                                            `The branch \`${branch}\` was removed.`,
                                        ],
                                    })
                                )
                            } else {
                                logError(`Error deleting ${branch}`);
                                result.push(
                                    new Result({
                                        id: this.taskId,
                                        success: false,
                                        executed: true,
                                        steps: [
                                            `Tried to remove not needed branch \`${branch}\`, but there was a problem.`,
                                        ],
                                    })
                                )
                            }
                        }
                    }
                }
            }
        } catch (error) {
            result.push(
                new Result({
                    id: this.taskId,
                    success: false,
                    executed: true,
                    steps: [
                        `Tried to remove not needed branches related to the issue, but there was a problem.`,
                    ],
                    error: error,
                })
            )
        }
        return result
    }
}
