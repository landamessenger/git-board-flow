import { Execution } from "../data/model/execution";
import { Result } from "../data/model/result";
import { logDebugInfo, logError, logInfo } from "../utils/logger";
import { ParamUseCase } from "./base/param_usecase";
import { CheckProgressUseCase } from "./actions/check_progress_use_case";
import { NotifyNewCommitOnIssueUseCase } from "./steps/commit/notify_new_commit_on_issue_use_case";
import { CheckChangesIssueSizeUseCase } from "./steps/commit/check_changes_issue_size_use_case";

export class CommitUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'CommitUseCase';

    async invoke(param: Execution): Promise<Result[]> {
        logInfo(`Executing ${this.taskId}.`);

        const results: Result[] = [];
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
            results.push(...(await new CheckProgressUseCase().invoke(param)));
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