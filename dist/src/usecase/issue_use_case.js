"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IssueUseCase = void 0;
const logger_1 = require("../utils/logger");
const check_permissions_use_case_1 = require("./steps/common/check_permissions_use_case");
const update_title_use_case_1 = require("./steps/common/update_title_use_case");
const assign_members_to_issue_use_case_1 = require("./steps/issue/assign_members_to_issue_use_case");
const check_priority_issue_size_use_case_1 = require("./steps/issue/check_priority_issue_size_use_case");
const close_not_allowed_issue_use_case_1 = require("./steps/issue/close_not_allowed_issue_use_case");
const label_deploy_added_use_case_1 = require("./steps/issue/label_deploy_added_use_case");
const label_deployed_added_use_case_1 = require("./steps/issue/label_deployed_added_use_case");
const link_issue_project_use_case_1 = require("./steps/issue/link_issue_project_use_case");
const prepare_branches_use_case_1 = require("./steps/issue/prepare_branches_use_case");
const remove_issue_branches_use_case_1 = require("./steps/issue/remove_issue_branches_use_case");
const remove_not_needed_branches_use_case_1 = require("./steps/issue/remove_not_needed_branches_use_case");
const update_issue_type_use_case_1 = require("./steps/issue/update_issue_type_use_case");
class IssueUseCase {
    constructor() {
        this.taskId = 'IssueUseCase';
    }
    async invoke(param) {
        (0, logger_1.logInfo)(`Executing ${this.taskId}.`);
        const results = [];
        const permissionResult = await new check_permissions_use_case_1.CheckPermissionsUseCase().invoke(param);
        const lastAction = permissionResult[permissionResult.length - 1];
        if (!lastAction.success && lastAction.executed) {
            results.push(...permissionResult);
            results.push(...await new close_not_allowed_issue_use_case_1.CloseNotAllowedIssueUseCase().invoke(param));
            return results;
        }
        if (param.cleanIssueBranches) {
            results.push(...await new remove_issue_branches_use_case_1.RemoveIssueBranchesUseCase().invoke(param));
        }
        /**
         * Assignees
         */
        results.push(...await new assign_members_to_issue_use_case_1.AssignMemberToIssueUseCase().invoke(param));
        /**
         * Update title
         */
        results.push(...await new update_title_use_case_1.UpdateTitleUseCase().invoke(param));
        /**
         * Update issue type
         */
        results.push(...await new update_issue_type_use_case_1.UpdateIssueTypeUseCase().invoke(param));
        /**
         * Link issue to project
         */
        results.push(...await new link_issue_project_use_case_1.LinkIssueProjectUseCase().invoke(param));
        /**
         * Check priority issue size
         */
        results.push(...await new check_priority_issue_size_use_case_1.CheckPriorityIssueSizeUseCase().invoke(param));
        /**
         * Prepare branches
         */
        if (param.isBranched) {
            results.push(...await new prepare_branches_use_case_1.PrepareBranchesUseCase().invoke(param));
        }
        else {
            results.push(...await new remove_issue_branches_use_case_1.RemoveIssueBranchesUseCase().invoke(param));
        }
        /**
         * Remove unnecessary branches
         */
        results.push(...await new remove_not_needed_branches_use_case_1.RemoveNotNeededBranchesUseCase().invoke(param));
        /**
         * Check if deploy label was added
         */
        results.push(...await new label_deploy_added_use_case_1.DeployAddedUseCase().invoke(param));
        /**
         * Check if deployed label was added
         */
        results.push(...await new label_deployed_added_use_case_1.DeployedAddedUseCase().invoke(param));
        return results;
    }
}
exports.IssueUseCase = IssueUseCase;
