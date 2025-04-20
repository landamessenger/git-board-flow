"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssignReviewersToIssueUseCase = void 0;
const result_1 = require("../../../data/model/result");
const issue_repository_1 = require("../../../data/repository/issue_repository");
const project_repository_1 = require("../../../data/repository/project_repository");
const pull_request_repository_1 = require("../../../data/repository/pull_request_repository");
const logger_1 = require("../../../utils/logger");
class AssignReviewersToIssueUseCase {
    constructor() {
        this.taskId = 'AssignReviewersToIssueUseCase';
        this.issueRepository = new issue_repository_1.IssueRepository();
        this.pullRequestRepository = new pull_request_repository_1.PullRequestRepository();
        this.projectRepository = new project_repository_1.ProjectRepository();
    }
    async invoke(param) {
        (0, logger_1.logInfo)(`Executing ${this.taskId}.`);
        const desiredReviewersCount = param.pullRequest.desiredReviewersCount;
        const number = param.pullRequest.number;
        const result = [];
        try {
            (0, logger_1.logDebugInfo)(`#${number} needs ${desiredReviewersCount} reviewers.`);
            const currentReviewers = await this.pullRequestRepository.getCurrentReviewers(param.owner, param.repo, number, param.tokens.token);
            const currentAssignees = await this.issueRepository.getCurrentAssignees(param.owner, param.repo, number, param.tokens.token);
            if (currentReviewers.length >= desiredReviewersCount) {
                /**
                 * No more assignees needed
                 */
                result.push(new result_1.Result({
                    id: this.taskId,
                    success: true,
                    executed: true,
                }));
                return result;
            }
            const missingReviewers = desiredReviewersCount - currentReviewers.length;
            (0, logger_1.logDebugInfo)(`#${number} needs ${missingReviewers} more reviewers.`);
            const excludeForReview = [];
            excludeForReview.push(param.pullRequest.creator);
            excludeForReview.push(...currentReviewers);
            excludeForReview.push(...currentAssignees);
            const members = await this.projectRepository.getRandomMembers(param.owner, missingReviewers, excludeForReview, param.tokens.token);
            if (members.length === 0) {
                result.push(new result_1.Result({
                    id: this.taskId,
                    success: false,
                    executed: true,
                    steps: [
                        `Tried to assign members as reviewers to pull request, but no one was found.`,
                    ],
                }));
                return result;
            }
            const reviewersAdded = await this.pullRequestRepository.addReviewersToPullRequest(param.owner, param.repo, number, members, param.tokens.token);
            for (const member of reviewersAdded) {
                if (members.indexOf(member) > -1)
                    result.push(new result_1.Result({
                        id: this.taskId,
                        success: true,
                        executed: true,
                        steps: [
                            `@${member} was requested to review the pull request.`,
                        ],
                    }));
            }
            return result;
        }
        catch (error) {
            (0, logger_1.logError)(error);
            result.push(new result_1.Result({
                id: this.taskId,
                success: false,
                executed: true,
                steps: [
                    `Tried to assign members to issue.`,
                ],
                error: error,
            }));
        }
        return result;
    }
}
exports.AssignReviewersToIssueUseCase = AssignReviewersToIssueUseCase;
