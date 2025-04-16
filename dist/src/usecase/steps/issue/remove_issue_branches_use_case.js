"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RemoveIssueBranchesUseCase = void 0;
const result_1 = require("../../../data/model/result");
const branch_repository_1 = require("../../../data/repository/branch_repository");
const logger_1 = require("../../../utils/logger");
/**
 * Remove any branch created for this issue
 */
class RemoveIssueBranchesUseCase {
    constructor() {
        this.taskId = 'RemoveIssueBranchesUseCase';
        this.branchRepository = new branch_repository_1.BranchRepository();
    }
    async invoke(param) {
        (0, logger_1.logInfo)(`Executing ${this.taskId}.`);
        const results = [];
        try {
            const branchTypes = [param.branches.featureTree, param.branches.bugfixTree];
            const branches = await this.branchRepository.getListOfBranches(param.owner, param.repo, param.tokens.token);
            for (const type of branchTypes) {
                (0, logger_1.logDebugInfo)(`Checking branch type ${type}`);
                let branchName = '';
                const prefix = `${type}/${param.issueNumber}-`;
                (0, logger_1.logDebugInfo)(`Checking prefix ${prefix}`);
                const matchingBranch = branches.find(branch => branch.indexOf(prefix) > -1);
                if (!matchingBranch)
                    continue;
                branchName = matchingBranch;
                const removed = await this.branchRepository.removeBranch(param.owner, param.repo, branchName, param.tokens.token);
                if (removed) {
                    results.push(new result_1.Result({
                        id: this.taskId,
                        success: true,
                        executed: true,
                        steps: [
                            `The branch \`${branchName}\` was removed.`,
                        ],
                    }));
                    if (param.previousConfiguration?.branchType === param.branches.hotfixTree) {
                        results.push(new result_1.Result({
                            id: this.taskId,
                            success: true,
                            executed: true,
                            reminders: [
                                `Determine if the \`${param.branches.hotfixTree}\` branch is no longer required and can be removed.`,
                            ],
                        }));
                    }
                }
            }
        }
        catch (error) {
            (0, logger_1.logError)(error);
            results.push(new result_1.Result({
                id: this.taskId,
                success: false,
                executed: true,
                steps: [
                    `Tried to update issue's title, but there was a problem.`,
                ],
                error: error,
            }));
        }
        return results;
    }
}
exports.RemoveIssueBranchesUseCase = RemoveIssueBranchesUseCase;
