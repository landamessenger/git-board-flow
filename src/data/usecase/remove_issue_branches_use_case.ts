import {BranchRepository} from "../repository/branch_repository";
import {ParamUseCase} from "./base/param_usecase";
import {Execution} from "../model/execution";
import {Result} from "../model/result";
import * as core from '@actions/core';

/**
 * Remove any branch created for this issue
 */
export class RemoveIssueBranchesUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'RemoveIssueBranchesUseCase';
    private branchRepository = new BranchRepository();

    async invoke(param: Execution): Promise<Result[]> {
        core.info(`Running ${this.taskId}`)

        const results: Result[] = []
        try {
            const branchTypes = [param.branches.featureTree, param.branches.bugfixTree];

            const branches = await this.branchRepository.getListOfBranches(
                param.owner,
                param.repo,
                param.tokens.token,
            );

            for (const type of branchTypes) {
                core.info(`Checking branch type ${type}`)

                let branchName = '';
                const prefix = `${type}/${param.number}-`;
                core.info(`Checking prefix ${prefix}`)

                const matchingBranch = branches.find(branch => branch.indexOf(prefix) > -1);
                if (!matchingBranch) continue;
                branchName = matchingBranch;
                const removed = await this.branchRepository.removeBranch(
                    param.owner,
                    param.repo,
                    branchName,
                    param.tokens.token,
                );
                if (removed) {
                    results.push(
                        new Result({
                            id: this.taskId,
                            success: true,
                            executed: true,
                            steps: [
                                `The branch \`${branchName}\` was removed.`,
                            ],
                        })
                    )
                    if (param.previousConfiguration?.branchType === param.branches.hotfixTree) {
                        results.push(
                            new Result({
                                id: this.taskId,
                                success: true,
                                executed: true,
                                reminders: [
                                    `Ensure if \`${param.branches.featureTree}\` should be removed.`,
                                ],
                            })
                        )
                    }
                }
            }
        } catch (error) {
            console.error(error);
            results.push(
                new Result({
                    id: this.taskId,
                    success: false,
                    executed: true,
                    steps: [
                        `Tried to update issue's title, but there was a problem.`,
                    ],
                    error: error,
                })
            )
        }
        return results;
    }
}