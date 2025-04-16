"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateIssueTypeUseCase = void 0;
const result_1 = require("../../../data/model/result");
const issue_repository_1 = require("../../../data/repository/issue_repository");
const logger_1 = require("../../../utils/logger");
class UpdateIssueTypeUseCase {
    constructor() {
        this.taskId = 'UpdateIssueTypeUseCase';
        this.issueRepository = new issue_repository_1.IssueRepository();
    }
    async invoke(param) {
        (0, logger_1.logInfo)(`Executing ${this.taskId}.`);
        const result = [];
        try {
            await this.issueRepository.setIssueType(param.owner, param.repo, param.issueNumber, param.labels, param.issueTypes, param.tokens.token);
        }
        catch (error) {
            (0, logger_1.logError)(error);
            result.push(new result_1.Result({
                id: this.taskId,
                success: false,
                executed: true,
                steps: [
                    `Tried to update issue type, but there was a problem.`,
                ],
                error: error,
            }));
        }
        return result;
    }
}
exports.UpdateIssueTypeUseCase = UpdateIssueTypeUseCase;
