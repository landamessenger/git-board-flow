import { Execution } from "../data/model/execution";
import { Result } from "../data/model/result";
import { logInfo } from "../utils/logger";
import { getTaskEmoji } from "../utils/task_emoji";
import { ParamUseCase } from "./base/param_usecase";
import { RecommendStepsUseCase } from "./actions/recommend_steps_use_case";
import { CheckPermissionsUseCase } from "./steps/common/check_permissions_use_case";
import { UpdateTitleUseCase } from "./steps/common/update_title_use_case";
import { AnswerIssueHelpUseCase } from "./steps/issue/answer_issue_help_use_case";
import { AssignMemberToIssueUseCase } from "./steps/issue/assign_members_to_issue_use_case";
import { CheckPriorityIssueSizeUseCase } from "./steps/issue/check_priority_issue_size_use_case";
import { CloseNotAllowedIssueUseCase } from "./steps/issue/close_not_allowed_issue_use_case";
import { DeployAddedUseCase } from "./steps/issue/label_deploy_added_use_case";
import { DeployedAddedUseCase } from "./steps/issue/label_deployed_added_use_case";
import { LinkIssueProjectUseCase } from "./steps/issue/link_issue_project_use_case";
import { PrepareBranchesUseCase } from "./steps/issue/prepare_branches_use_case";
import { RemoveIssueBranchesUseCase } from "./steps/issue/remove_issue_branches_use_case";
import { RemoveNotNeededBranchesUseCase } from "./steps/issue/remove_not_needed_branches_use_case";
import { UpdateIssueTypeUseCase } from "./steps/issue/update_issue_type_use_case";

export class IssueUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'IssueUseCase';

    async invoke(param: Execution): Promise<Result[]> {
        logInfo(`${getTaskEmoji(this.taskId)} Executing ${this.taskId}.`)

        const results: Result[] = []

        const permissionResult = await new CheckPermissionsUseCase().invoke(param);
        const lastAction = permissionResult[permissionResult.length - 1];
        if (!lastAction.success && lastAction.executed) {
            results.push(...permissionResult)
            results.push(...await new CloseNotAllowedIssueUseCase().invoke(param));
            return results;
        }

        if (param.cleanIssueBranches) {
            results.push(...await new RemoveIssueBranchesUseCase().invoke(param));
        }

        /**
         * Assignees
         */
        results.push(...await new AssignMemberToIssueUseCase().invoke(param));

        /**
         * Update title
         */
        results.push(...await new UpdateTitleUseCase().invoke(param));

        /**
         * Update issue type
         */
        results.push(...await new UpdateIssueTypeUseCase().invoke(param));

        /**
         * Link issue to project
         */
        results.push(...await new LinkIssueProjectUseCase().invoke(param));

        /**
         * Check priority issue size
         */
        results.push(...await new CheckPriorityIssueSizeUseCase().invoke(param));

        /**
         * Prepare branches
         */
        if (param.isBranched) {
            results.push(...await new PrepareBranchesUseCase().invoke(param));
        } else {
            results.push(...await new RemoveIssueBranchesUseCase().invoke(param));
        }

        /**
         * Remove unnecessary branches
         */
        results.push(...await new RemoveNotNeededBranchesUseCase().invoke(param));

        /**
         * Check if deploy label was added
         */
        results.push(...await new DeployAddedUseCase().invoke(param));

        /**
         * Check if deployed label was added
         */
        results.push(...await new DeployedAddedUseCase().invoke(param));

        /**
         * On newly opened issues: recommend steps (non release/question/help) or post initial help (question/help).
         */
        if (param.issue.opened) {
            const isRelease = param.labels.isRelease;
            const isQuestionOrHelp = param.labels.isQuestion || param.labels.isHelp;
            if (!isRelease && !isQuestionOrHelp) {
                results.push(...(await new RecommendStepsUseCase().invoke(param)));
            } else if (isQuestionOrHelp) {
                results.push(...(await new AnswerIssueHelpUseCase().invoke(param)));
            }
        }

        return results;
    }
}