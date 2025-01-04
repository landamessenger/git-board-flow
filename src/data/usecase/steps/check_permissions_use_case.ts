import {ParamUseCase} from "../base/param_usecase";
import {Execution} from "../../model/execution";
import {ProjectRepository} from "../../repository/project_repository";
import * as core from "@actions/core";
import {Result} from "../../model/result";

export class CheckPermissionsUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'CheckPermissionsUseCase';
    private projectRepository = new ProjectRepository();

    async invoke(param: Execution): Promise<Result[]> {
        core.info(`Executing ${this.taskId}.`);

        const number = param.isIssue ? param.issue.number : param.pullRequest.number;
        const result: Result[] = [];

        /**
         * If a release/hotfix issue was opened, check if author is a member of the project.
         */
        if (!param.issue.opened) {
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
            core.info(`Checking #${number} action authorization.`);

            const currentProjectMembers = await this.projectRepository.getAllMembers(
                param.owner,
                param.tokens.tokenPat,
            )

            const pullRequestCreatorIsTeamMember = param.isPullRequest
                && param.pullRequest.creator.length > 0
                && currentProjectMembers.indexOf(param.pullRequest.creator) > -1;

            const issueCreatorIsMember = param.isIssue
                && param.issue.creator.length > 0
                && currentProjectMembers.indexOf(param.issue.creator) === -1;

            if (param.labels.isMandatoryBranchedLabel) {
                if (issueCreatorIsMember || pullRequestCreatorIsTeamMember) {
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
                result.push(
                    new Result({
                        id: this.taskId,
                        success: true,
                        executed: true,
                    })
                );
            }
        } catch (error) {
            console.error(error);
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
