import * as github from "@actions/github";
import { Execution } from "../../../data/model/execution";
import { Result } from "../../../data/model/result";
import { PullRequestRepository } from "../../../data/repository/pull_request_repository";
import { logError, logInfo } from "../../../utils/logger";
import { ParamUseCase } from "../../base/param_usecase";

export class LinkPullRequestIssueUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'LinkPullRequestIssueUseCase';
    
    private pullRequestRepository = new PullRequestRepository();

    async invoke(param: Execution): Promise<Result[]> {
        logInfo(`Executing ${this.taskId}.`)

        const result: Result[] = []

        try {
            const isLinked = await this.pullRequestRepository.isLinked(github.context.payload.pull_request?.html_url ?? '');

            if (!isLinked) {
                /**
                 *  Set the primary/default branch
                 */
                await this.pullRequestRepository.updateBaseBranch(
                    param.owner,
                    param.repo,
                    param.pullRequest.number,
                    param.branches.defaultBranch,
                    param.tokens.githubToken,
                )

                result.push(
                    new Result({
                        id: this.taskId,
                        success: true,
                        executed: true,
                        steps: [
                            `The base branch was temporarily updated to \`${param.branches.defaultBranch}\`.`,
                        ],
                    })
                )

                /**
                 *  Update PR's description.
                 */
                let prBody = param.pullRequest.body;

                let updatedBody = `${prBody}\n\nResolves #${param.issueNumber}`;
                await this.pullRequestRepository.updateDescription(
                    param.owner,
                    param.repo,
                    param.pullRequest.number,
                    updatedBody,
                    param.tokens.githubToken,
                );

                result.push(
                    new Result({
                        id: this.taskId,
                        success: true,
                        executed: true,
                        steps: [
                            `The description was temporarily modified to include a reference to issue **#${param.issueNumber}**.`,
                        ],
                    })
                )

                /**
                 *  Await 20 seconds
                 */
                await new Promise(resolve => setTimeout(resolve, 20 * 1000));

                /**
                 *  Restore the original branch
                 */
                await this.pullRequestRepository.updateBaseBranch(
                    param.owner,
                    param.repo,
                    param.pullRequest.number,
                    param.pullRequest.base,
                    param.tokens.githubToken,
                )

                result.push(
                    new Result({
                        id: this.taskId,
                        success: true,
                        executed: true,
                        steps: [
                            `The base branch was reverted to its original value: \`${param.pullRequest.base}\`.`,
                        ],
                    })
                )

                /**
                 * Restore comment on description
                 */
                prBody = param.pullRequest.body;
                updatedBody = prBody.replace(`\n\nResolves #${param.issueNumber}`, "");
                await this.pullRequestRepository.updateDescription(
                    param.owner,
                    param.repo,
                    param.pullRequest.number,
                    updatedBody,
                    param.tokens.githubToken,
                );

                result.push(
                    new Result({
                        id: this.taskId,
                        success: true,
                        executed: true,
                        steps: [
                            `The temporary issue reference **#${param.issueNumber}** was removed from the description.`,
                        ],
                    })
                )

                return result;
            }
        } catch (error) {
            logError(error);
            result.push(
                new Result({
                    id: this.taskId,
                    success: false,
                    executed: true,
                    steps: [
                        `Tried to link pull request to project, but there was a problem.`,
                    ],
                    error: error,
                })
            )
        }
        return result;
    }
}