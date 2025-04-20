"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LinkPullRequestProjectUseCase = void 0;
const result_1 = require("../../../data/model/result");
const project_repository_1 = require("../../../data/repository/project_repository");
const logger_1 = require("../../../utils/logger");
class LinkPullRequestProjectUseCase {
    constructor() {
        this.taskId = 'LinkPullRequestProjectUseCase';
        this.projectRepository = new project_repository_1.ProjectRepository();
    }
    async invoke(param) {
        (0, logger_1.logInfo)(`Executing ${this.taskId}.`);
        const result = [];
        const columnName = param.project.getProjectColumnPullRequestCreated();
        try {
            for (const project of param.project.getProjects()) {
                let actionDone = await this.projectRepository.linkContentId(project, param.pullRequest.id, param.tokens.token);
                if (actionDone) {
                    /**
                     * Wait for 10 seconds to ensure the pull request is linked to the project
                     */
                    await new Promise(resolve => setTimeout(resolve, 10000));
                    actionDone = await this.projectRepository.moveIssueToColumn(project, param.owner, param.repo, param.pullRequest.number, columnName, param.tokens.token);
                    if (actionDone) {
                        result.push(new result_1.Result({
                            id: this.taskId,
                            success: true,
                            executed: true,
                            steps: [
                                `The pull request was linked to [**${project?.title}**](${project?.url}) and moved to the column \`${columnName}\`.`,
                            ],
                        }));
                    }
                    else {
                        result.push(new result_1.Result({
                            id: this.taskId,
                            success: false,
                            executed: true,
                            steps: [
                                `The pull request was linked to [**${project?.title}**](${project?.url}) but there was an error moving it to the column \`${columnName}\`.`,
                            ],
                        }));
                    }
                }
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
                    `Tried to link pull request to project, but there was a problem.`,
                ],
                error: error,
            }));
        }
        return result;
    }
}
exports.LinkPullRequestProjectUseCase = LinkPullRequestProjectUseCase;
