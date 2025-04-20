"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeployedAddedUseCase = void 0;
const result_1 = require("../../../data/model/result");
const logger_1 = require("../../../utils/logger");
class DeployedAddedUseCase {
    constructor() {
        this.taskId = 'DeployedAddedUseCase';
    }
    async invoke(param) {
        (0, logger_1.logInfo)(`Executing ${this.taskId}.`);
        const result = [];
        try {
            if (param.issue.labeled && param.issue.labelAdded === param.labels.deployed) {
                (0, logger_1.logDebugInfo)(`Deploy complete.`);
                if (param.release.active && param.release.branch !== undefined) {
                    const releaseUrl = `https://github.com/${param.owner}/${param.repo}/tree/${param.release.branch}`;
                    result.push(new result_1.Result({
                        id: this.taskId,
                        success: true,
                        executed: true,
                        steps: [
                            `Deploy complete from [${param.release.branch}](${releaseUrl})`
                        ]
                    }));
                }
                else if (param.hotfix.active && param.hotfix.branch !== undefined) {
                    const hotfixUrl = `https://github.com/${param.owner}/${param.repo}/tree/${param.hotfix.branch}`;
                    result.push(new result_1.Result({
                        id: this.taskId,
                        success: true,
                        executed: true,
                        steps: [
                            `Deploy complete from [${param.hotfix.branch}](${hotfixUrl})`
                        ]
                    }));
                }
            }
            else {
                result.push(new result_1.Result({
                    id: this.taskId,
                    success: true,
                    executed: false,
                }));
            }
        }
        catch (error) {
            (0, logger_1.logError)(error);
            result.push(new result_1.Result({
                id: this.taskId,
                success: false,
                executed: true,
                steps: [
                    `Tried to complete the deployment, but there was a problem.`,
                ],
                errors: [
                    error?.toString() ?? 'Unknown error',
                ],
            }));
        }
        return result;
    }
}
exports.DeployedAddedUseCase = DeployedAddedUseCase;
