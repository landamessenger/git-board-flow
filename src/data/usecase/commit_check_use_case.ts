import { Execution } from "../model/execution";
import { Result } from "../model/result";
import { logDebugInfo, logError, logInfo } from "../utils/logger";
import { ParamUseCase } from "./base/param_usecase";
import { CheckChangesIssueSizeUseCase } from "./steps/check_changes_issue_size_use_case";
import { NotifyNewCommitOnIssueUseCase } from "./steps/notify_new_commit_on_issue_use_case";

export class CommitCheckUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'CommitCheckUseCase';

    async invoke(param: Execution): Promise<Result[]> {
        logInfo(`Executing ${this.taskId}.`)

        const results: Result[] = []
        try {
            if (param.commit.commits.length === 0) {
                logDebugInfo('No commits found in this push.');
                return results;
            }

            logDebugInfo(`Branch: ${param.commit.branch}`);
            logDebugInfo(`Commits detected: ${param.commit.commits.length}`);
            logDebugInfo(`Issue number: ${param.issueNumber}`);
           
            results.push(...(await new NotifyNewCommitOnIssueUseCase().invoke(param)));
            results.push(...(await new CheckChangesIssueSizeUseCase().invoke(param)));
        } catch (error) {
            logError(error);
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