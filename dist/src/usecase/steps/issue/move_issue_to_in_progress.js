"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MoveIssueToInProgressUseCase = void 0;
const result_1 = require("../../../data/model/result");
const project_repository_1 = require("../../../data/repository/project_repository");
const logger_1 = require("../../../utils/logger");
class MoveIssueToInProgressUseCase {
    constructor() {
        this.taskId = 'MoveIssueToInProgressUseCase';
        this.projectRepository = new project_repository_1.ProjectRepository();
    }
    async invoke(param) {
        (0, logger_1.logInfo)(`Executing ${this.taskId}.`);
        const result = [];
        const columnName = param.project.getProjectColumnIssueInProgress();
        try {
            for (const project of param.project.getProjects()) {
                const success = await this.projectRepository.moveIssueToColumn(project, param.owner, param.repo, param.issueNumber, columnName, param.tokens.token);
                if (success) {
                    result.push(new result_1.Result({
                        id: this.taskId,
                        success: true,
                        executed: true,
                        steps: [
                            `Moved issue to \`${columnName}\` in [${project.title}](https://github.com/${param.owner}/${param.repo}/projects/${project.id}).`,
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
                    `Tried to move the issue to \`${columnName}\`, but there was a problem.`,
                ],
                errors: [
                    error?.toString() ?? 'Unknown error',
                ],
            }));
        }
        return result;
    }
}
exports.MoveIssueToInProgressUseCase = MoveIssueToInProgressUseCase;
