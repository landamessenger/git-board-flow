import { Execution } from "../data/model/execution";
import { Result } from "../data/model/result";
import { logDebugInfo, logError, logInfo } from "../utils/logger";
import { ParamUseCase } from "./base/param_usecase";
import { UpdateTitleUseCase } from "./steps/common/update_title_use_case";
import { AssignMemberToIssueUseCase } from "./steps/issue/assign_members_to_issue_use_case";
import { AssignReviewersToIssueUseCase } from "./steps/issue/assign_reviewers_to_issue_use_case";
import { CloseIssueAfterMergingUseCase } from "./steps/issue/close_issue_after_merging_use_case";
import { CheckChangesPullRequestSizeUseCase } from "./steps/pull_request/check_changes_pull_request_size_use_case";
import { CheckPriorityPullRequestSizeUseCase } from "./steps/pull_request/check_priority_pull_request_size_use_case";
import { LinkPullRequestIssueUseCase } from "./steps/pull_request/link_pull_request_issue_use_case";
import { LinkPullRequestProjectUseCase } from "./steps/pull_request/link_pull_request_project_use_case";
import { UpdatePullRequestDescriptionUseCase } from "./steps/pull_request/update_pull_request_description_use_case";

export class PullRequestLinkUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'PullRequestLinkUseCase';

    async invoke(param: Execution): Promise<Result[]> {
        logInfo(`Executing ${this.taskId}.`)

        const results: Result[] = []
        try {
            logDebugInfo(`PR action ${param.pullRequest.action}`)
            logDebugInfo(`PR isOpened ${param.pullRequest.isOpened}`)
            logDebugInfo(`PR isMerged ${param.pullRequest.isMerged}`)
            logDebugInfo(`PR isClosed ${param.pullRequest.isClosed}`)
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

                /**
                 * Check priority pull request size
                 */
                results.push(...await new CheckPriorityPullRequestSizeUseCase().invoke(param));

                /**
                 * Check changes size
                 */
                results.push(...await new CheckChangesPullRequestSizeUseCase().invoke(param));

                if (param.ai.getAiPullRequestDescription()) {
                    /**
                     * Update pull request description
                     */
                    results.push(...await new UpdatePullRequestDescriptionUseCase().invoke(param));
                }
            } else if (param.pullRequest.isSynchronize) {
                /**
                 * Check changes size
                 */
                results.push(...await new CheckChangesPullRequestSizeUseCase().invoke(param));
                
                /**
                 * Pushed changes to the pull request
                 */
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
            logError(error);
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