import * as core from "@actions/core";
import {ParamUseCase} from "../base/param_usecase";
import {Execution} from "../../model/execution";
import {BranchRepository} from "../../repository/branch_repository";
import {Result} from "../../model/result";

export class RemoveNotNeededBranchesUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'RemoveNotNeededBranchesUseCase';
    private branchRepository = new BranchRepository();

    async invoke(param: Execution): Promise<Result[]> {
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
            const sanitizedTitle = this.branchRepository.formatBranchName(issueTitle, param.number)

            const branches = await this.branchRepository.getListOfBranches(
                param.owner,
                param.repo,
                param.tokens.token,
            );

            const finalBranch = `${param.managementBranch}/${param.number}-${sanitizedTitle}`;

            const branchTypes = [param.branches.featureTree, param.branches.bugfixTree];
            for (const type of branchTypes) {
                let branchName = `${type}/${param.number}-${sanitizedTitle}`;
                const prefix = `${type}/${param.number}-`;

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
                        param.tokens.token,
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
                        core.error(`Error deleting ${branchName}`);
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
                                param.tokens.token,
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
                                core.error(`Error deleting ${branch}`);
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
