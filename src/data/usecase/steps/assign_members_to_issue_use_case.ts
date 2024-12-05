import {ParamUseCase} from "../base/param_usecase";
import {Execution} from "../../model/execution";
import {IssueRepository} from "../../repository/issue_repository";
import {ProjectRepository} from "../../repository/project_repository";
import * as core from "@actions/core";
import {Result} from "../../model/result";

export class AssignMemberToIssueUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'AssignMemberToIssueUseCase';
    private issueRepository = new IssueRepository();
    private projectRepository = new ProjectRepository();

    async invoke(param: Execution): Promise<Result[]> {
        core.info(`Executing ${this.taskId}.`)

        const desiredAssigneesCount = param.isIssue ?
            param.issue.desiredAssigneesCount : param.pullRequest.desiredAssigneesCount

        const number = param.isIssue ? param.issue.number : param.pullRequest.number

        const result: Result[] = []

        try {
            core.info(`#${number} needs ${desiredAssigneesCount} assignees.`)

            const currentMembers = await this.issueRepository.getCurrentAssignees(
                param.owner,
                param.repo,
                number,
                param.tokens.token,
            )

            if (currentMembers.length >= desiredAssigneesCount) {
                /**
                 * No more assignees needed
                 */
                result.push(
                    new Result({
                        id: this.taskId,
                        success: true,
                        executed: true,
                    })
                )
                return result
            }

            const missingAssignees = desiredAssigneesCount - currentMembers.length
            core.info(`#${number} needs ${missingAssignees} more assignees.`)


            const members = await this.projectRepository.getRandomMembers(
                param.owner,
                missingAssignees,
                currentMembers,
                param.tokens.tokenPat,
            )

            if (members.length === 0) {
                result.push(
                    new Result({
                        id: this.taskId,
                        success: false,
                        executed: true,
                        steps: [
                            `Tried to assign members to issue, but no one was found.`,
                        ],
                    })
                )
                return result
            }

            const membersAdded = await this.issueRepository.assignMembersToIssue(
                param.owner,
                param.repo,
                number,
                members,
                param.tokens.token,
            )

            for (const member of membersAdded) {
                if (members.indexOf(member) > -1)
                    result.push(
                        new Result({
                            id: this.taskId,
                            success: true,
                            executed: true,
                            steps: [
                                param.isIssue ? `The issue was assigned to @${member}.` : `The pull request was assigned to @${member}.`,
                            ],
                        })
                    )
            }

            return result;
        } catch (error) {
            console.error(error);
            result.push(
                new Result({
                    id: this.taskId,
                    success: false,
                    executed: true,
                    steps: [
                        `Tried to assign members to issue.`,
                    ],
                    error: error,
                })
            )
        }
        return result;
    }
}