"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeployedActionUseCase = void 0;
const result_1 = require("../../data/model/result");
const branch_repository_1 = require("../../data/repository/branch_repository");
const issue_repository_1 = require("../../data/repository/issue_repository");
const logger_1 = require("../../utils/logger");
class DeployedActionUseCase {
    constructor() {
        this.taskId = 'DeployedActionUseCase';
        this.issueRepository = new issue_repository_1.IssueRepository();
        this.branchRepository = new branch_repository_1.BranchRepository();
    }
    async invoke(param) {
        (0, logger_1.logInfo)(`Executing ${this.taskId}.`);
        const result = [];
        try {
            if (!param.labels.isDeploy) {
                result.push(new result_1.Result({
                    id: this.taskId,
                    success: false,
                    executed: true,
                    steps: [
                        `Tried to set label \`${param.labels.deployed}\` but there was no \`${param.labels.deploy}\` label.`,
                    ],
                }));
                return result;
            }
            if (param.labels.isDeployed) {
                result.push(new result_1.Result({
                    id: this.taskId,
                    success: false,
                    executed: true,
                    steps: [
                        `Tried to set label \`${param.labels.deployed}\` but it was already set.`,
                    ],
                }));
                return result;
            }
            const labelNames = param.labels.currentIssueLabels.filter(name => name !== param.labels.deploy);
            labelNames.push(param.labels.deployed);
            await this.issueRepository.setLabels(param.owner, param.repo, param.singleAction.currentSingleActionIssue, labelNames, param.tokens.token);
            (0, logger_1.logDebugInfo)(`Updated labels on issue #${param.singleAction.currentSingleActionIssue}:`);
            (0, logger_1.logDebugInfo)(`Labels: ${labelNames}`);
            result.push(new result_1.Result({
                id: this.taskId,
                success: true,
                executed: true,
                steps: [
                    `Label \`${param.labels.deployed}\` added after a success deploy.`,
                ],
            }));
            if (param.currentConfiguration.releaseBranch) {
                const mergeToDefaultResult = await this.branchRepository.mergeBranch(param.owner, param.repo, param.currentConfiguration.releaseBranch, param.branches.defaultBranch, param.pullRequest.mergeTimeout, param.tokens.token);
                result.push(...mergeToDefaultResult);
                const mergeToDevelopResult = await this.branchRepository.mergeBranch(param.owner, param.repo, param.currentConfiguration.releaseBranch, param.branches.development, param.pullRequest.mergeTimeout, param.tokens.token);
                result.push(...mergeToDevelopResult);
            }
            else if (param.currentConfiguration.hotfixBranch) {
                const mergeToDefaultResult = await this.branchRepository.mergeBranch(param.owner, param.repo, param.currentConfiguration.hotfixBranch, param.branches.defaultBranch, param.pullRequest.mergeTimeout, param.tokens.token);
                result.push(...mergeToDefaultResult);
                const mergeToDevelopResult = await this.branchRepository.mergeBranch(param.owner, param.repo, param.branches.defaultBranch, param.branches.development, param.pullRequest.mergeTimeout, param.tokens.token);
                result.push(...mergeToDevelopResult);
            }
            return result;
        }
        catch (error) {
            (0, logger_1.logError)(error);
            result.push(new result_1.Result({
                id: this.taskId,
                success: false,
                executed: true,
                steps: [`Tried to assign members to issue.`],
                error: error,
            }));
        }
        return result;
    }
}
exports.DeployedActionUseCase = DeployedActionUseCase;
