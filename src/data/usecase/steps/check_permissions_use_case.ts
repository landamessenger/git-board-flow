import {ParamUseCase} from "../base/param_usecase";
import {Execution} from "../../model/execution";
import {ProjectRepository} from "../../repository/project_repository";
import * as core from "@actions/core";
import {Result} from "../../model/result";
import { logError } from "../../utils/logger";

export class CheckPermissionsUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'CheckPermissionsUseCase';
    private projectRepository = new ProjectRepository();

    async invoke(param: Execution): Promise<Result[]> {
        core.info(`Executing ${this.taskId}.`);

        const result: Result[] = [];

        /**
         * If a release/hotfix issue was opened, check if author is a member of the project.
         */
        if (!param.issue.opened) {
            core.info(`Ignoring permission checking. Issue state is not 'opened'.`)
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
                core.info(`Ignoring permission checking. Issue doesn't require mandatory branch.`)
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
                core.info(`Ignoring permission checking. Issue doesn't require mandatory branch.`)
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
