"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PullRequestUseCase = void 0;
const result_1 = require("../data/model/result");
const logger_1 = require("../utils/logger");
const update_title_use_case_1 = require("./steps/common/update_title_use_case");
const assign_members_to_issue_use_case_1 = require("./steps/issue/assign_members_to_issue_use_case");
const assign_reviewers_to_issue_use_case_1 = require("./steps/issue/assign_reviewers_to_issue_use_case");
const close_issue_after_merging_use_case_1 = require("./steps/issue/close_issue_after_merging_use_case");
const check_changes_pull_request_size_use_case_1 = require("./steps/pull_request/check_changes_pull_request_size_use_case");
const check_priority_pull_request_size_use_case_1 = require("./steps/pull_request/check_priority_pull_request_size_use_case");
const link_pull_request_issue_use_case_1 = require("./steps/pull_request/link_pull_request_issue_use_case");
const link_pull_request_project_use_case_1 = require("./steps/pull_request/link_pull_request_project_use_case");
const update_pull_request_description_use_case_1 = require("./steps/pull_request/update_pull_request_description_use_case");
class PullRequestUseCase {
    constructor() {
        this.taskId = 'PullRequestUseCase';
    }
    async invoke(param) {
        (0, logger_1.logInfo)(`Executing ${this.taskId}.`);
        const results = [];
        try {
            (0, logger_1.logDebugInfo)(`PR action ${param.pullRequest.action}`);
            (0, logger_1.logDebugInfo)(`PR isOpened ${param.pullRequest.isOpened}`);
            (0, logger_1.logDebugInfo)(`PR isMerged ${param.pullRequest.isMerged}`);
            (0, logger_1.logDebugInfo)(`PR isClosed ${param.pullRequest.isClosed}`);
            if (param.pullRequest.isOpened) {
                /**
                 * Update title
                 */
                results.push(...await new update_title_use_case_1.UpdateTitleUseCase().invoke(param));
                /**
                 * Assignees
                 */
                results.push(...await new assign_members_to_issue_use_case_1.AssignMemberToIssueUseCase().invoke(param));
                /**
                 * Reviewers
                 */
                results.push(...await new assign_reviewers_to_issue_use_case_1.AssignReviewersToIssueUseCase().invoke(param));
                /**
                 * Link Pull Request to projects
                 */
                results.push(...await new link_pull_request_project_use_case_1.LinkPullRequestProjectUseCase().invoke(param));
                /**
                 * Link Pull Request to issue
                 */
                results.push(...await new link_pull_request_issue_use_case_1.LinkPullRequestIssueUseCase().invoke(param));
                /**
                 * Check priority pull request size
                 */
                results.push(...await new check_priority_pull_request_size_use_case_1.CheckPriorityPullRequestSizeUseCase().invoke(param));
                /**
                 * Check changes size
                 */
                results.push(...await new check_changes_pull_request_size_use_case_1.CheckChangesPullRequestSizeUseCase().invoke(param));
                if (param.ai.getAiPullRequestDescription()) {
                    /**
                     * Update pull request description
                     */
                    results.push(...await new update_pull_request_description_use_case_1.UpdatePullRequestDescriptionUseCase().invoke(param));
                }
            }
            else if (param.pullRequest.isSynchronize) {
                /**
                 * Check changes size
                 */
                results.push(...await new check_changes_pull_request_size_use_case_1.CheckChangesPullRequestSizeUseCase().invoke(param));
                /**
                 * Pushed changes to the pull request
                 */
                if (param.ai.getAiPullRequestDescription()) {
                    /**
                     * Update pull request description
                     */
                    results.push(...await new update_pull_request_description_use_case_1.UpdatePullRequestDescriptionUseCase().invoke(param));
                }
            }
            else if (param.pullRequest.isClosed && param.pullRequest.isMerged) {
                /**
                 * Close issue if needed
                 */
                results.push(...await new close_issue_after_merging_use_case_1.CloseIssueAfterMergingUseCase().invoke(param));
            }
        }
        catch (error) {
            (0, logger_1.logError)(error);
            results.push(new result_1.Result({
                id: this.taskId,
                success: false,
                executed: true,
                steps: [
                    `Error linking projects/issues with pull request.`,
                ],
                error: error,
            }));
        }
        return results;
    }
}
exports.PullRequestUseCase = PullRequestUseCase;
