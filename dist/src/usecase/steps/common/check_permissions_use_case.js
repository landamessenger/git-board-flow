"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CheckPermissionsUseCase = void 0;
const result_1 = require("../../../data/model/result");
const project_repository_1 = require("../../../data/repository/project_repository");
const logger_1 = require("../../../utils/logger");
class CheckPermissionsUseCase {
    constructor() {
        this.taskId = 'CheckPermissionsUseCase';
        this.projectRepository = new project_repository_1.ProjectRepository();
    }
    async invoke(param) {
        (0, logger_1.logInfo)(`Executing ${this.taskId}.`);
        const result = [];
        /**
         * If a release/hotfix issue was opened, check if author is a member of the project.
         */
        if (param.isIssue && !param.issue.opened) {
            (0, logger_1.logDebugInfo)(`Ignoring permission checking. Issue state is not 'opened'.`);
            result.push(new result_1.Result({
                id: this.taskId,
                success: true,
                executed: false,
            }));
            return result;
        }
        else if (param.isPullRequest && !param.pullRequest.opened) {
            (0, logger_1.logDebugInfo)(`Ignoring permission checking. Pull request state is not 'opened'.`);
            result.push(new result_1.Result({
                id: this.taskId,
                success: true,
                executed: false,
            }));
            return result;
        }
        try {
            const currentProjectMembers = await this.projectRepository.getAllMembers(param.owner, param.tokens.token);
            const creator = param.isIssue ? param.issue.creator : param.pullRequest.creator;
            const creatorIsTeamMember = creator.length > 0
                && currentProjectMembers.indexOf(creator) > -1;
            if (param.labels.isMandatoryBranchedLabel) {
                (0, logger_1.logDebugInfo)(`Ignoring permission checking. Issue doesn't require mandatory branch.`);
                if (creatorIsTeamMember) {
                    result.push(new result_1.Result({
                        id: this.taskId,
                        success: true,
                        executed: true,
                    }));
                }
                else {
                    result.push(new result_1.Result({
                        id: this.taskId,
                        success: false,
                        executed: true,
                        steps: [`@${param.issue.creator} was not authorized to create **[${param.labels.currentIssueLabels.join(',')}]** issues.`],
                    }));
                }
            }
            else {
                (0, logger_1.logDebugInfo)(`Ignoring permission checking. Issue doesn't require mandatory branch.`);
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
                steps: [`Tried to check action permissions.`],
                error: error,
            }));
        }
        return result;
    }
}
exports.CheckPermissionsUseCase = CheckPermissionsUseCase;
