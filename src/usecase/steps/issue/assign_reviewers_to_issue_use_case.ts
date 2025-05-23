import { Execution } from "../../../data/model/execution";
import { Result } from "../../../data/model/result";
import { IssueRepository } from "../../../data/repository/issue_repository";
import { ProjectRepository } from "../../../data/repository/project_repository";
import { PullRequestRepository } from "../../../data/repository/pull_request_repository";
import { logDebugInfo, logError, logInfo } from "../../../utils/logger";
import { ParamUseCase } from "../../base/param_usecase";

export class AssignReviewersToIssueUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'AssignReviewersToIssueUseCase';
    
    private issueRepository = new IssueRepository();
    private pullRequestRepository = new PullRequestRepository();
    private projectRepository = new ProjectRepository();

    async invoke(param: Execution): Promise<Result[]> {
        logInfo(`Executing ${this.taskId}.`)

        const desiredReviewersCount = param.pullRequest.desiredReviewersCount
        const number = param.pullRequest.number

        const result: Result[] = []

        try {
            logDebugInfo(`#${number} needs ${desiredReviewersCount} reviewers.`)

            const currentReviewers = await this.pullRequestRepository.getCurrentReviewers(
                param.owner,
                param.repo,
                number,
                param.tokens.token,
            )

            const currentAssignees = await this.issueRepository.getCurrentAssignees(
                param.owner,
                param.repo,
                number,
                param.tokens.token,
            )

            if (currentReviewers.length >= desiredReviewersCount) {
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

            const missingReviewers = desiredReviewersCount - currentReviewers.length
            logDebugInfo(`#${number} needs ${missingReviewers} more reviewers.`)


            const excludeForReview: string[] = []
            excludeForReview.push(param.pullRequest.creator)
            excludeForReview.push(...currentReviewers)
            excludeForReview.push(...currentAssignees)

            const members = await this.projectRepository.getRandomMembers(
                param.owner,
                missingReviewers,
                excludeForReview,
                param.tokens.token,
            )

            if (members.length === 0) {
                result.push(
                    new Result({
                        id: this.taskId,
                        success: false,
                        executed: true,
                        steps: [
                            `Tried to assign members as reviewers to pull request, but no one was found.`,
                        ],
                    })
                )
                return result
            }

            const reviewersAdded = await this.pullRequestRepository.addReviewersToPullRequest(
                param.owner,
                param.repo,
                number,
                members,
                param.tokens.token,
            )

            for (const member of reviewersAdded) {
                if (members.indexOf(member) > -1)
                    result.push(
                        new Result({
                            id: this.taskId,
                            success: true,
                            executed: true,
                            steps: [
                                `@${member} was requested to review the pull request.`,
                            ],
                        })
                    )
            }

            return result;
        } catch (error) {
            logError(error);
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