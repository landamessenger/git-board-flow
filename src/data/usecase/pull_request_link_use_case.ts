import {ParamUseCase} from "./base/param_usecase";
import {Execution} from "../model/execution";
import {Result} from "../model/result";
import {LinkPullRequestProjectUseCase} from "./steps/link_pull_request_project_use_case";
import {LinkPullRequestIssueUseCase} from "./steps/link_pull_request_issue_use_case";
import * as core from '@actions/core';
import {CloseIssueAfterMergingUseCase} from "./steps/close_issue_after_merging_use_case";
import {AssignMemberToIssueUseCase} from "./steps/assign_members_to_issue_use_case";
import {AssignReviewersToIssueUseCase} from "./steps/assign_reviewers_to_issue_use_case";
import {UpdateTitleUseCase} from "./steps/update_title_use_case";
import { UpdatePullRequestDescriptionUseCase } from "./steps/update_pull_request_description_use_case";

export class PullRequestLinkUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'PullRequestLinkUseCase';

    async invoke(param: Execution): Promise<Result[]> {
        core.info(`Executing ${this.taskId}.`)

        const results: Result[] = []
        try {
            console.log(`PR action ${param.pullRequest.action}`)
            console.log(`PR isOpened ${param.pullRequest.isOpened}`)
            console.log(`PR isMerged ${param.pullRequest.isMerged}`)
            console.log(`PR isClosed ${param.pullRequest.isClosed}`)
            if (param.pullRequest.isOpened) {
                /**
                 * Update title
                 */
                results.push(...await new UpdateTitleUseCase().invoke(param));

                /**
                 * Assignees
                 */
                results.push(...await new AssignMemberToIssueUseCase().invoke(param));

                /**
                 * Reviewers
                 */
                results.push(...await new AssignReviewersToIssueUseCase().invoke(param));

                /**
                 * Link Pull Request to projects
                 */
                results.push(...await new LinkPullRequestProjectUseCase().invoke(param));

                /**
                 * Link Pull Request to issue
                 */
                results.push(...await new LinkPullRequestIssueUseCase().invoke(param));

                if (param.ai.getAiPullRequestDescription()) {
                    /**
                     * Update pull request description
                     */
                    results.push(...await new UpdatePullRequestDescriptionUseCase().invoke(param));
                }
            } else if (param.pullRequest.isClosed && param.pullRequest.isMerged) {
                /**
                 * Close issue if needed
                 */
                results.push(...await new CloseIssueAfterMergingUseCase().invoke(param));
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