"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CheckPriorityPullRequestSizeUseCase = void 0;
const result_1 = require("../../../data/model/result");
const project_repository_1 = require("../../../data/repository/project_repository");
const logger_1 = require("../../../utils/logger");
class CheckPriorityPullRequestSizeUseCase {
    constructor() {
        this.taskId = 'CheckPriorityPullRequestSizeUseCase';
        this.projectRepository = new project_repository_1.ProjectRepository();
    }
    async invoke(param) {
        (0, logger_1.logInfo)(`Executing ${this.taskId}.`);
        const result = [];
        try {
            const priority = param.labels.priorityLabelOnIssue;
            if (!param.labels.priorityLabelOnIssueProcessable || param.project.getProjects().length === 0) {
                result.push(new result_1.Result({
                    id: this.taskId,
                    success: true,
                    executed: false,
                }));
                return result;
            }
            let priorityLabel = ``;
            if (priority === param.labels.priorityHigh) {
                priorityLabel = `P0`;
            }
            else if (priority === param.labels.priorityMedium) {
                priorityLabel = `P1`;
            }
            else if (priority === param.labels.priorityLow) {
                priorityLabel = `P2`;
            }
            else {
                result.push(new result_1.Result({
                    id: this.taskId,
                    success: true,
                    executed: false,
                }));
                return result;
            }
            (0, logger_1.logDebugInfo)(`Priority: ${priority}`);
            (0, logger_1.logDebugInfo)(`Github Priority Label: ${priorityLabel}`);
            for (const project of param.project.getProjects()) {
                const success = await this.projectRepository.setTaskPriority(project, param.owner, param.repo, param.pullRequest.number, priorityLabel, param.tokens.token);
                if (success) {
                    result.push(new result_1.Result({
                        id: this.taskId,
                        success: true,
                        executed: true,
                        steps: [
                            `Priority set to \`${priorityLabel}\` in [${project.title}](https://github.com/${param.owner}/${param.repo}/projects/${project.id}).`,
                        ],
                    }));
                }
            }
        }
        catch (error) {
            (0, logger_1.logError)(error);
            result.push(new result_1.Result({
                id: this.taskId,
                success: false,
                executed: true,
                steps: [
                    `Tried to check the priority of the issue, but there was a problem.`,
                ],
                errors: [
                    error?.toString() ?? 'Unknown error',
                ],
            }));
        }
        return result;
    }
}
exports.CheckPriorityPullRequestSizeUseCase = CheckPriorityPullRequestSizeUseCase;
