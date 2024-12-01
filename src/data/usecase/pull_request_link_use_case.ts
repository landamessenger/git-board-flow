import {ParamUseCase} from "./base/param_usecase";
import {Execution} from "../model/execution";
import {Result} from "../model/result";
import {LinkPullRequestProjectUseCase} from "./steps/link_pull_request_project_use_case";
import {LinkPullRequestIssueUseCase} from "./steps/link_pull_request_issue_use_case";
import * as core from '@actions/core';
import {CloseIssueUseCase} from "./steps/close_issue_use_case";

export class PullRequestLinkUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'PullRequestLinkUseCase';

    async invoke(param: Execution): Promise<Result[]> {
        core.info(`Executing ${this.taskId}.`)

        const results: Result[] = []
        try {
            if (!param.pullRequest.isOpened) {
                /**
                 * Link Pull Request to projects
                 */
                results.push(...await new LinkPullRequestProjectUseCase().invoke(param));

                /**
                 * Link Pull Request to issue
                 */
                results.push(...await new LinkPullRequestIssueUseCase().invoke(param));
                results.push(...await new LinkPullRequestIssueUseCase().invoke(param));
            } else if (param.pullRequest.isClosed && param.pullRequest.isMerged) {
                /**
                 * Close issue if needed
                 */
                results.push(...await new CloseIssueUseCase().invoke(param));
            }
        } catch (error) {
            console.error(error);
            results.push(
                new Result({
                    id: this.taskId,
                    success: false,
                    executed: true,
                    steps: [
                        `Error linking projects/issues with pull request.`,
                    ],
                    error: error,
                })
            )
        }
        return results;
    }
}