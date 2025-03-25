import {ParamUseCase} from "../base/param_usecase";
import {Execution} from "../../model/execution";
import {IssueRepository} from "../../repository/issue_repository";
import * as core from "@actions/core";
import {Result} from "../../model/result";
import {BranchRepository} from "../../repository/branch_repository";
import { logError } from "../../utils/logger";

export class DeployedActionUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'DeployedActionUseCase';
    private issueRepository = new IssueRepository();
    private branchRepository = new BranchRepository();

    async invoke(param: Execution): Promise<Result[]> {
        core.info(`Executing ${this.taskId}.`);

        const result: Result[] = [];

        try {
            if (!param.labels.isDeploy) {
                result.push(
                    new Result({
                        id: this.taskId,
                        success: false,
                        executed: true,
                        steps: [
                            `Tried to set label \`${param.labels.deployed}\` but there was no \`${param.labels.deploy}\` label.`,
                        ],
                    })
                );
                return result;
            }

            if (param.labels.isDeployed) {
                result.push(
                    new Result({
                        id: this.taskId,
                        success: false,
                        executed: true,
                        steps: [
                            `Tried to set label \`${param.labels.deployed}\` but it was already set.`,
                        ],
                    })
                );
                return result;
            }

            const labelNames = param.labels.currentIssueLabels.filter(name => name !== param.labels.deploy);
            labelNames.push(param.labels.deployed);

            await this.issueRepository.setLabels(
                param.owner,
                param.repo,
                param.singleAction.currentSingleActionIssue,
                labelNames,
                param.tokens.token,
            )

            console.log(`Updated labels on issue #${param.singleAction.currentSingleActionIssue}:`, labelNames);

            result.push(
                new Result({
                    id: this.taskId,
                    success: true,
                    executed: true,
                    steps: [
                        `Label \`${param.labels.deployed}\` added after a success deploy.`,
                    ],
                })
            );

            if (param.currentConfiguration.releaseBranch) {
                const mergeToDefaultResult = await this.branchRepository.mergeBranch(
                    param.owner,
                    param.repo,
                    param.currentConfiguration.releaseBranch,
                    param.branches.defaultBranch,
                    param.pullRequest.mergeTimeout,
                    param.tokens.token,
                    param.tokens.tokenPat,
                );
                result.push(...mergeToDefaultResult);

                const mergeToDevelopResult = await this.branchRepository.mergeBranch(
                    param.owner,
                    param.repo,
                    param.currentConfiguration.releaseBranch,
                    param.branches.development,
                    param.pullRequest.mergeTimeout,
                    param.tokens.token,
                    param.tokens.tokenPat,
                );
                result.push(...mergeToDevelopResult);
            } else if (param.currentConfiguration.hotfixBranch) {
                const mergeToDefaultResult = await this.branchRepository.mergeBranch(
                    param.owner,
                    param.repo,
                    param.currentConfiguration.hotfixBranch,
                    param.branches.defaultBranch,
                    param.pullRequest.mergeTimeout,
                    param.tokens.token,
                    param.tokens.tokenPat,
                );
                result.push(...mergeToDefaultResult);

                const mergeToDevelopResult = await this.branchRepository.mergeBranch(
                    param.owner,
                    param.repo,
                    param.branches.defaultBranch,
                    param.branches.development,
                    param.pullRequest.mergeTimeout,
                    param.tokens.token,
                    param.tokens.tokenPat,
                );
                result.push(...mergeToDevelopResult);
            }
            
            return result;
        } catch (error) {
            logError(error);
            result.push(
                new Result({
                    id: this.taskId,
                    success: false,
                    executed: true,
                    steps: [`Tried to assign members to issue.`],
                    error: error,
                })
            );
        }

        return result;
    }
}
