"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.RemoveNotNeededBranchesUseCase = void 0;
const core = __importStar(require("@actions/core"));
const result_1 = require("../../../data/model/result");
const branch_repository_1 = require("../../../data/repository/branch_repository");
const logger_1 = require("../../../utils/logger");
class RemoveNotNeededBranchesUseCase {
    constructor() {
        this.taskId = 'RemoveNotNeededBranchesUseCase';
        this.branchRepository = new branch_repository_1.BranchRepository();
    }
    async invoke(param) {
        (0, logger_1.logInfo)(`Executing ${this.taskId}.`);
        const result = [];
        try {
            const issueTitle = param.issue.title;
            if (issueTitle.length === 0) {
                core.setFailed('Issue title not available.');
                result.push(new result_1.Result({
                    id: this.taskId,
                    success: true,
                    executed: true,
                    steps: [
                        `Tried to remove not needed branches related to the issue, but the issue title was not found.`,
                    ],
                }));
                return result;
            }
            const sanitizedTitle = this.branchRepository.formatBranchName(issueTitle, param.issueNumber);
            const branches = await this.branchRepository.getListOfBranches(param.owner, param.repo, param.tokens.token);
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
                    const removed = await this.branchRepository.removeBranch(param.owner, param.repo, branchName, param.tokens.token);
                    if (removed) {
                        result.push(new result_1.Result({
                            id: this.taskId,
                            success: true,
                            executed: true,
                            steps: [
                                `The branch \`${branchName}\` was removed.`,
                            ],
                        }));
                    }
                    else {
                        (0, logger_1.logError)(`Error deleting ${branchName}`);
                        result.push(new result_1.Result({
                            id: this.taskId,
                            success: false,
                            executed: true,
                            steps: [
                                `Tried to remove not needed branch \`${branchName}\`, but there was a problem.`,
                            ],
                        }));
                    }
                }
                else {
                    for (const branch of branches) {
                        if (branch.indexOf(prefix) > -1 && branch !== finalBranch) {
                            const removed = await this.branchRepository.removeBranch(param.owner, param.repo, branch, param.tokens.token);
                            if (removed) {
                                result.push(new result_1.Result({
                                    id: this.taskId,
                                    success: true,
                                    executed: true,
                                    steps: [
                                        `The branch \`${branch}\` was removed.`,
                                    ],
                                }));
                            }
                            else {
                                (0, logger_1.logError)(`Error deleting ${branch}`);
                                result.push(new result_1.Result({
                                    id: this.taskId,
                                    success: false,
                                    executed: true,
                                    steps: [
                                        `Tried to remove not needed branch \`${branch}\`, but there was a problem.`,
                                    ],
                                }));
                            }
                        }
                    }
                }
            }
        }
        catch (error) {
            result.push(new result_1.Result({
                id: this.taskId,
                success: false,
                executed: true,
                steps: [
                    `Tried to remove not needed branches related to the issue, but there was a problem.`,
                ],
                error: error,
            }));
        }
        return result;
    }
}
exports.RemoveNotNeededBranchesUseCase = RemoveNotNeededBranchesUseCase;
