/**
 * Runs verify commands and then git add/commit/push for bugbot autofix.
 * Uses @actions/exec; intended to run in the GitHub Action runner where the repo is checked out.
 */
import type { Execution } from "../../../../data/model/execution";
export interface BugbotAutofixCommitResult {
    success: boolean;
    committed: boolean;
    error?: string;
}
/**
 * Runs verify commands (if configured), then git add, commit, and push.
 * When branchOverride is set, checks out that branch first (e.g. for issue_comment events).
 */
export declare function runBugbotAutofixCommitAndPush(execution: Execution, options?: {
    branchOverride?: string;
}): Promise<BugbotAutofixCommitResult>;
