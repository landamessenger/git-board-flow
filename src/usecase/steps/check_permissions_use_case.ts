import { Execution } from "../../data/model/execution";
import { Result } from "../../data/model/result";
import { ProjectRepository } from "../../data/repository/project_repository";
import { logDebugInfo, logError, logInfo } from "../../utils/logger";
import { ParamUseCase } from "../base/param_usecase";

export class CheckPermissionsUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'CheckPermissionsUseCase';
    
    private projectRepository = new ProjectRepository();

    async invoke(param: Execution): Promise<Result[]> {
        logInfo(`Executing ${this.taskId}.`);

        const result: Result[] = [];

        /**
         * If a release/hotfix issue was opened, check if author is a member of the project.
         */
        if (!param.issue.opened) {
            logDebugInfo(`Ignoring permission checking. Issue state is not 'opened'.`)
            result.push(
                new Result({
                    id: this.taskId,
                    success: true,
                    executed: false,
                })
            );
            return result;
        }

        try {
            const currentProjectMembers = await this.projectRepository.getAllMembers(
                param.owner,
                param.tokens.tokenPat,
            )

            const creator = param.isIssue ? param.issue.creator : param.pullRequest.creator;

            const creatorIsTeamMember = creator.length > 0
                && currentProjectMembers.indexOf(creator) > -1;

            if (param.labels.isMandatoryBranchedLabel) {
                logDebugInfo(`Ignoring permission checking. Issue doesn't require mandatory branch.`)
                if (creatorIsTeamMember) {
                    result.push(
                        new Result({
                            id: this.taskId,
                            success: true,
                            executed: true,
                        })
                    );
                } else {
                    result.push(
                        new Result({
                            id: this.taskId,
                            success: false,
                            executed: true,
                            steps: [`@${param.issue.creator} was not authorized to create **[${param.labels.currentIssueLabels.join(',')}]** issues.`],
                        })
                    );
                }
            } else {
                logDebugInfo(`Ignoring permission checking. Issue doesn't require mandatory branch.`)
                result.push(
                    new Result({
                        id: this.taskId,
                        success: true,
                        executed: true,
                    })
                );
            }
        } catch (error) {
            logError(error);
            result.push(
                new Result({
                    id: this.taskId,
                    success: false,
                    executed: true,
                    steps: [`Tried to check action permissions.`],
                    error: error,
                })
            );
        }

        return result;
    }
}
