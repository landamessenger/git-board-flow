import {ParamUseCase} from "./base/param_usecase";
import {Execution} from "../model/execution";
import {LinkIssueProjectUseCase} from "./steps/link_issue_project_use_case";
import {UpdateTitleUseCase} from "./steps/update_title_use_case";
import {PrepareBranchesUseCase} from "./steps/prepare_branches_use_case";
import {RemoveNotNeededBranchesUseCase} from "./steps/remove_not_needed_branches_use_case";
import {Result} from "../model/result";
import {RemoveIssueBranchesUseCase} from "./remove_issue_branches_use_case";
import * as core from '@actions/core';
import {AssignMemberToIssueUseCase} from "./steps/assign_members_to_issue_use_case";
import {CheckPermissionsUseCase} from "./steps/check_permissions_use_case";
import {CloseNotAllowedIssueUseCase} from "./steps/close_not_allowed_issue_use_case";
import {DeployAddedUseCase} from "./steps/label_deploy_added_use_case";

export class IssueLinkUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'IssueLinkUseCase';

    async invoke(param: Execution): Promise<Result[]> {
        core.info(`Executing ${this.taskId}.`)

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
         * Link issue to project
         */
        results.push(...await new LinkIssueProjectUseCase().invoke(param));

        /**
         * Update title
         */
        results.push(...await new UpdateTitleUseCase().invoke(param));

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

        return results;
    }
}