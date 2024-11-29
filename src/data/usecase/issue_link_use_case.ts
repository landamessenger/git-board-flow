import {ParamUseCase} from "./base/param_usecase";
import {Execution} from "../model/execution";
import {LinkIssueProjectUseCase} from "./steps/link_issue_project_use_case";
import {UpdateTitleUseCase} from "./steps/update_title_use_case";
import {PrepareBranchesUseCase} from "./steps/prepare_branches_use_case";
import {RemoveNotNeededBranchesUseCase} from "./steps/remove_not_needed_branches_use_case";
import {Result} from "../model/result";
import {RemoveIssueBranchesUseCase} from "./remove_issue_branches_use_case";
import * as core from '@actions/core';

export class IssueLinkUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'IssueLinkUseCase';

    async invoke(param: Execution): Promise<Result[]> {
        core.info(`Executing ${this.taskId}.`)

        const results: Result[] = []

        if (param.cleanManagement) {
            results.push(...await new RemoveIssueBranchesUseCase().invoke(param));
        }

        /**
         * Link issue to project
         */
        results.push(...await new LinkIssueProjectUseCase().invoke(param));

        /**
         * Update title
         */
        results.push(...await new UpdateTitleUseCase().invoke(param));

        /**
         * When hotfix, prepare it first
         */
        results.push(...await new PrepareBranchesUseCase().invoke(param));

        /**
         * Remove unnecessary branches
         */
        results.push(...await new RemoveNotNeededBranchesUseCase().invoke(param));

        return results;
    }
}