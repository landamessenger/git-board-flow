import {ParamUseCase} from "./base/param_usecase";
import {Execution} from "../model/execution";
import {Result} from "../model/result";
import * as core from '@actions/core';
import { CheckChangesIssueSizeUseCase } from "./steps/check_changes_issue_size_use_case";
import { NotifyNewCommitOnIssueUseCase } from "./steps/notify_new_commit_on_issue_use_case";

export class CommitCheckUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'CommitCheckUseCase';

    async invoke(param: Execution): Promise<Result[]> {
        core.info(`Executing ${this.taskId}.`)

        const results: Result[] = []
        try {
            if (param.commit.commits.length === 0) {
                core.info('No commits found in this push.');
                return results;
            }

            core.info(`Branch: ${param.commit.branch}`);
            core.info(`Commits detected: ${param.commit.commits.length}`);
            core.info(`Issue number: ${param.issueNumber}`);
           
            results.push(...(await new NotifyNewCommitOnIssueUseCase().invoke(param)));
            results.push(...(await new CheckChangesIssueSizeUseCase().invoke(param)));
        } catch (error) {
            console.error(error);
            results.push(
                new Result({
                    id: this.taskId,
                    success: false,
                    executed: true,
                    steps: [
                        `Error processing the commits.`,
                    ],
                    error: error,
                })
            )
        }
        return results;
    }
}