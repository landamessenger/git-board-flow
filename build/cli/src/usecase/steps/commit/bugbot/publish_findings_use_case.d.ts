/**
 * Publishes bugbot findings to the issue (and optionally to the PR as review comments).
 * For the issue: we always add or update a comment per finding (with marker).
 * For the PR: we only create a review comment when finding.file is in the PR's changed files list
 * (prContext.prFiles). We use pathToFirstDiffLine when finding has no line so the comment attaches
 * to a valid line in the diff. GitHub API requires (path, line) to exist in the PR diff.
 */
import type { Execution } from "../../../../data/model/execution";
import type { BugbotContext } from "./types";
import type { BugbotFinding } from "./types";
export interface PublishFindingsParam {
    execution: Execution;
    context: BugbotContext;
    findings: BugbotFinding[];
    /** Commit SHA for bugbot watermark (commit link). When set, comment uses "for commit ..." watermark. */
    commitSha?: string;
    /** When findings were limited by max comments, add one summary comment with this overflow info. */
    overflowCount?: number;
    overflowTitles?: string[];
}
/** Creates or updates issue comments for each finding; creates PR review comments only when finding.file is in prFiles. */
export declare function publishFindings(param: PublishFindingsParam): Promise<void>;
