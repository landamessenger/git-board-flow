"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CloseNotAllowedIssueUseCase = void 0;
const result_1 = require("../../../data/model/result");
const issue_repository_1 = require("../../../data/repository/issue_repository");
const logger_1 = require("../../../utils/logger");
class CloseNotAllowedIssueUseCase {
    constructor() {
        this.taskId = 'CloseNotAllowedIssueUseCase';
        this.issueRepository = new issue_repository_1.IssueRepository();
    }
    async invoke(param) {
        (0, logger_1.logInfo)(`Executing ${this.taskId}.`);
        const result = [];
        try {
            const closed = await this.issueRepository.closeIssue(param.owner, param.repo, param.issueNumber, param.tokens.token);
            if (closed) {
                await this.issueRepository.addComment(param.owner, param.repo, param.issueNumber, `This issue has been closed because the author is not a member of the project. The user may be banned if the fact is repeated.`, param.tokens.token);
                result.push(new result_1.Result({
                    id: this.taskId,
                    success: true,
                    executed: true,
                    steps: [
                        `#${param.issueNumber} was automatically closed because the author is not a member of the project.`
                    ]
                }));
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
            result.push(new result_1.Result({
                id: this.taskId,
                success: false,
                executed: true,
                steps: [
                    `Tried to close issue #${param.issueNumber}, but there was a problem.`,
                ],
                error: error,
            }));
        }
        return result;
    }
}
exports.CloseNotAllowedIssueUseCase = CloseNotAllowedIssueUseCase;
