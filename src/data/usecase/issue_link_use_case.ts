import { Execution } from "../model/execution";
import { Result } from "../model/result";
import { logInfo } from "../utils/logger";
import { ParamUseCase } from "./base/param_usecase";
import { RemoveIssueBranchesUseCase } from "./remove_issue_branches_use_case";
import { AssignMemberToIssueUseCase } from "./steps/assign_members_to_issue_use_case";
import { CheckPermissionsUseCase } from "./steps/check_permissions_use_case";
import { CheckPriorityIssueSizeUseCase } from "./steps/check_priority_issue_size_use_case";
import { CloseNotAllowedIssueUseCase } from "./steps/close_not_allowed_issue_use_case";
import { DeployAddedUseCase } from "./steps/label_deploy_added_use_case";
import { DeployedAddedUseCase } from "./steps/label_deployed_added_use_case";
import { LinkIssueProjectUseCase } from "./steps/link_issue_project_use_case";
import { PrepareBranchesUseCase } from "./steps/prepare_branches_use_case";
import { RemoveNotNeededBranchesUseCase } from "./steps/remove_not_needed_branches_use_case";
import { UpdateIssueTypeUseCase } from "./steps/update_issue_type_use_case";
import { UpdateTitleUseCase } from "./steps/update_title_use_case";

export class IssueLinkUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'IssueLinkUseCase';

    async invoke(param: Execution): Promise<Result[]> {
        logInfo(`Executing ${this.taskId}.`)

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

        return results;
    }
}