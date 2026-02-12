/**
 * Runs verify commands and then git add/commit/push for bugbot autofix.
 * Uses @actions/exec; intended to run in the GitHub Action runner where the repo is checked out.
 * Configures git user.name and user.email from the token user so the commit has a valid author.
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
    targetFindingIds?: string[];
}): Promise<BugbotAutofixCommitResult>;
