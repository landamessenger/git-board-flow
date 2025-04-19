"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CheckChangesPullRequestSizeUseCase = void 0;
const result_1 = require("../../../data/model/result");
const branch_repository_1 = require("../../../data/repository/branch_repository");
const issue_repository_1 = require("../../../data/repository/issue_repository");
const project_repository_1 = require("../../../data/repository/project_repository");
const logger_1 = require("../../../utils/logger");
class CheckChangesPullRequestSizeUseCase {
    constructor() {
        this.taskId = 'CheckChangesPullRequestSizeUseCase';
        this.branchRepository = new branch_repository_1.BranchRepository();
        this.issueRepository = new issue_repository_1.IssueRepository();
        this.projectRepository = new project_repository_1.ProjectRepository();
    }
    async invoke(param) {
        (0, logger_1.logInfo)(`Executing ${this.taskId}.`);
        const result = [];
        try {
            const { size, githubSize, reason } = await this.branchRepository.getSizeCategoryAndReason(param.owner, param.repo, param.pullRequest.head, param.pullRequest.base, param.sizeThresholds, param.labels, param.tokens.token);
            (0, logger_1.logDebugInfo)(`Size: ${size}`);
            (0, logger_1.logDebugInfo)(`Github Size: ${githubSize}`);
            (0, logger_1.logDebugInfo)(`Reason: ${reason}`);
            (0, logger_1.logDebugInfo)(`Labels: ${param.labels.sizedLabelOnPullRequest}`);
            if (param.labels.sizedLabelOnPullRequest !== size) {
                /**
                 * Even if this is for pull reuqets, we are getting the issue labels for having a mirror of the issue labels on the pull request.
                 */
                const labelNames = param.labels.currentIssueLabels.filter(name => param.labels.sizeLabels.indexOf(name) === -1);
                labelNames.push(size);
                await this.issueRepository.setLabels(param.owner, param.repo, param.pullRequest.number, labelNames, param.tokens.token);
                for (const project of param.project.getProjects()) {
                    await this.projectRepository.setTaskSize(project, param.owner, param.repo, param.pullRequest.number, githubSize, param.tokens.token);
                }
                (0, logger_1.logDebugInfo)(`Updated labels on pull request #${param.pullRequest.number}:`);
                (0, logger_1.logDebugInfo)(`Labels: ${labelNames}`);
                result.push(new result_1.Result({
                    id: this.taskId,
                    success: true,
                    executed: true,
                    steps: [
                        `${reason}, so the pull request was resized to ${size}.`,
                    ],
                }));
            }
            else {
                (0, logger_1.logDebugInfo)(`The pull request is already at the correct size.`);
                result.push(new result_1.Result({
                    id: this.taskId,
                    success: true,
                    executed: true,
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
                    `Tried to check the size of the changes, but there was a problem.`,
                ],
                errors: [
                    error?.toString() ?? 'Unknown error',
                ],
            }));
        }
        return result;
    }
}
exports.CheckChangesPullRequestSizeUseCase = CheckChangesPullRequestSizeUseCase;
