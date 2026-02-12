/**
 * Bugbot types: data structures used across detection, publishing, and autofix.
 * OpenCode computes the diff and returns findings; we never pass a pre-computed diff to OpenCode.
 */

/** Single finding from OpenCode (plan agent). Agent computes diff itself and returns id, title, description, optional file/line/severity/suggestion. */
export interface BugbotFinding {
    id: string;
    title: string;
    description: string;
    file?: string;
    line?: number;
    severity?: string;
    suggestion?: string;
}

/** Tracks where we posted a finding (issue and/or PR comment) and whether it is marked resolved. */
export interface ExistingFindingInfo {
    issueCommentId?: number;
    prCommentId?: number;
    prNumber?: number;
    resolved: boolean;
}

export type ExistingByFindingId = Record<string, ExistingFindingInfo>;

/**
 * PR metadata used only when publishing findings to GitHub. Not sent to OpenCode.
 * prFiles: list of files changed in the PR (for validating finding.file before creating review comment).
 * pathToFirstDiffLine: first line of diff per file (fallback when finding has no line; GitHub API requires a line in the diff).
 */
export interface BugbotPrContext {
    prHeadSha: string;
    prFiles: Array<{ filename: string; status: string }>;
    pathToFirstDiffLine: Record<string, number>;
}

/** Unresolved finding with full comment body (for intent prompt). */
export interface UnresolvedFindingWithBody {
    id: string;
    fullBody: string;
}

/**
 * Full context for bugbot: existing findings (from issue + PR comments), open PRs,
 * prompt block for "previously reported issues" (sent to OpenCode), and PR context for publishing.
 */
export interface BugbotContext {
    existingByFindingId: ExistingByFindingId;
    issueComments: Array<{ id: number; body: string | null }>;
    openPrNumbers: number[];
    /** Formatted text block sent to OpenCode so it can decide resolved_finding_ids (task 2). */
    previousFindingsBlock: string;
    prContext: BugbotPrContext | null;
    /** Unresolved findings with full body; used by intent prompt and autofix. */
    unresolvedFindingsWithBody: UnresolvedFindingWithBody[];
}
