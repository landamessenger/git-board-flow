import { Execution } from "../../data/model/execution";
import { Result } from "../../data/model/result";
import { BranchRepository } from "../../data/repository/branch_repository";
import { IssueRepository } from "../../data/repository/issue_repository";
import { logDebugInfo, logError, logInfo } from "../../utils/logger";
import { ParamUseCase } from "../base/param_usecase";

export class DeployedActionUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'DeployedActionUseCase';
    private issueRepository = new IssueRepository();
    private branchRepository = new BranchRepository();

    async invoke(param: Execution): Promise<Result[]> {
        logInfo(`Executing ${this.taskId}.`);

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
                param.singleAction.issue,
                labelNames,
                param.tokens.token,
            )

            logDebugInfo(`Updated labels on issue #${param.singleAction.issue}:`);
            logDebugInfo(`Labels: ${labelNames}`);

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
                );
                result.push(...mergeToDefaultResult);

                const mergeToDevelopResult = await this.branchRepository.mergeBranch(
                    param.owner,
                    param.repo,
                    param.currentConfiguration.releaseBranch,
                    param.branches.development,
                    param.pullRequest.mergeTimeout,
                    param.tokens.token,
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
                );
                result.push(...mergeToDefaultResult);

                const mergeToDevelopResult = await this.branchRepository.mergeBranch(
                    param.owner,
                    param.repo,
                    param.branches.defaultBranch,
                    param.branches.development,
                    param.pullRequest.mergeTimeout,
                    param.tokens.token,
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
