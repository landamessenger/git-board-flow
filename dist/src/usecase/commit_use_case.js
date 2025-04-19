"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommitUseCase = void 0;
const result_1 = require("../data/model/result");
const logger_1 = require("../utils/logger");
const notify_new_commit_on_issue_use_case_1 = require("./steps/commit/notify_new_commit_on_issue_use_case");
const check_changes_issue_size_use_case_1 = require("./steps/commit/check_changes_issue_size_use_case");
class CommitUseCase {
    constructor() {
        this.taskId = 'CommitUseCase';
    }
    async invoke(param) {
        (0, logger_1.logInfo)(`Executing ${this.taskId}.`);
        const results = [];
        try {
            if (param.commit.commits.length === 0) {
                (0, logger_1.logDebugInfo)('No commits found in this push.');
                return results;
            }
            (0, logger_1.logDebugInfo)(`Branch: ${param.commit.branch}`);
            (0, logger_1.logDebugInfo)(`Commits detected: ${param.commit.commits.length}`);
            (0, logger_1.logDebugInfo)(`Issue number: ${param.issueNumber}`);
            results.push(...(await new notify_new_commit_on_issue_use_case_1.NotifyNewCommitOnIssueUseCase().invoke(param)));
            results.push(...(await new check_changes_issue_size_use_case_1.CheckChangesIssueSizeUseCase().invoke(param)));
        }
        catch (error) {
            (0, logger_1.logError)(error);
            results.push(new result_1.Result({
                id: this.taskId,
                success: false,
                executed: true,
                steps: [
                    `Error processing the commits.`,
                ],
                error: error,
            }));
        }
        return results;
    }
}
exports.CommitUseCase = CommitUseCase;
