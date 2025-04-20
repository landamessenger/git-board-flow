"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetReleaseTypeUseCase = void 0;
const result_1 = require("../../../data/model/result");
const issue_repository_1 = require("../../../data/repository/issue_repository");
const content_utils_1 = require("../../../utils/content_utils");
const logger_1 = require("../../../utils/logger");
class GetReleaseTypeUseCase {
    constructor() {
        this.taskId = 'GetReleaseTypeUseCase';
        this.issueRepository = new issue_repository_1.IssueRepository();
    }
    async invoke(param) {
        (0, logger_1.logInfo)(`Executing ${this.taskId}.`);
        const result = [];
        try {
            let number = -1;
            if (param.isSingleAction) {
                number = param.singleAction.currentSingleActionIssue;
            }
            else if (param.isIssue) {
                number = param.issue.number;
            }
            else if (param.isPullRequest) {
                number = param.pullRequest.number;
            }
            else {
                result.push(new result_1.Result({
                    id: this.taskId,
                    success: false,
                    executed: true,
                    steps: [`Tried to get the release type but there was a problem identifying the issue.`],
                }));
                return result;
            }
            const description = await this.issueRepository.getDescription(param.owner, param.repo, number, param.tokens.token);
            if (description === undefined) {
                result.push(new result_1.Result({
                    id: this.taskId,
                    success: false,
                    executed: true,
                    steps: [`Tried to get the release type but there was a problem getting the description.`],
                }));
                return result;
            }
            const releaseType = (0, content_utils_1.extractReleaseType)('Release Type', description);
            if (releaseType === undefined) {
                result.push(new result_1.Result({
                    id: this.taskId,
                    success: false,
                    executed: true,
                    steps: [`Tried to get the release type but there was a problem identifying the type.`],
                }));
                return result;
            }
            result.push(new result_1.Result({
                id: this.taskId,
                success: true,
                executed: true,
                payload: {
                    releaseType: releaseType,
                }
            }));
        }
        catch (error) {
            (0, logger_1.logError)(error);
            result.push(new result_1.Result({
                id: this.taskId,
                success: false,
                executed: true,
                steps: [`Tried to check action permissions.`],
                error: error,
            }));
        }
        return result;
    }
}
exports.GetReleaseTypeUseCase = GetReleaseTypeUseCase;
