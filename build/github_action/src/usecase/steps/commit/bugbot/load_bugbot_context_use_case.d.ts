/**
 * Loads all bugbot context: existing findings from issue and PR comments (via marker parsing),
 * open PR numbers for the head branch, the formatted "previous findings" block for OpenCode,
 * and PR metadata (head sha, changed files, first diff line per file) used only when publishing
 * findings to GitHub — not sent to OpenCode.
 */
import type { Execution } from "../../../../data/model/execution";
import type { BugbotContext } from "./types";
export interface LoadBugbotContextOptions {
    /** When set (e.g. for issue_comment when commit.branch is empty), use this branch to find open PRs. */
    branchOverride?: string;
}
/**
 * Loads all context needed for bugbot: existing findings from issue + PR comments,
 * open PR numbers, and the prompt block for previously reported issues.
 * Also loads PR context (head sha, files, diff lines) for the first open PR.
 */
export declare function loadBugbotContext(param: Execution, options?: LoadBugbotContextOptions): Promise<BugbotContext>;
