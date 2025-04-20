"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LinkIssueProjectUseCase = void 0;
const result_1 = require("../../../data/model/result");
const issue_repository_1 = require("../../../data/repository/issue_repository");
const project_repository_1 = require("../../../data/repository/project_repository");
const logger_1 = require("../../../utils/logger");
class LinkIssueProjectUseCase {
    constructor() {
        this.taskId = 'LinkIssueProjectUseCase';
        this.issueRepository = new issue_repository_1.IssueRepository();
        this.projectRepository = new project_repository_1.ProjectRepository();
    }
    async invoke(param) {
        (0, logger_1.logInfo)(`Executing ${this.taskId}.`);
        const result = [];
        const columnName = param.project.getProjectColumnIssueCreated();
        try {
            for (const project of param.project.getProjects()) {
                const issueId = await this.issueRepository.getId(param.owner, param.repo, param.issue.number, param.tokens.token);
                let actionDone = await this.projectRepository.linkContentId(project, issueId, param.tokens.token);
                if (actionDone) {
                    /**
                     * Wait for 10 seconds to ensure the issue is linked to the project
                     */
                    await new Promise(resolve => setTimeout(resolve, 10000));
                    actionDone = await this.projectRepository.moveIssueToColumn(project, param.owner, param.repo, param.issue.number, columnName, param.tokens.token);
                    if (actionDone) {
                        result.push(new result_1.Result({
                            id: this.taskId,
                            success: true,
                            executed: true,
                            steps: [
                                `The issue was linked to [**${project?.title}**](${project?.url}) and moved to the column \`${columnName}\`.`,
                            ]
                        }));
                    }
                    else {
                        result.push(new result_1.Result({
                            id: this.taskId,
                            success: false,
                            executed: true,
                            steps: [
                                `The issue was linked to [**${project?.title}**](${project?.url}) but there was an error moving it to the column \`${columnName}\`.`,
                            ]
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
                    `Tried to link issue to project, but there was a problem.`,
                ],
                error: error,
            }));
        }
        return result;
    }
}
exports.LinkIssueProjectUseCase = LinkIssueProjectUseCase;
