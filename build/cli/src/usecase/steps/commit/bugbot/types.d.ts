/** Single finding from OpenCode (agent computes changes and returns these). */
export interface BugbotFinding {
    id: string;
    title: string;
    description: string;
    file?: string;
    line?: number;
    severity?: string;
    suggestion?: string;
}
export interface ExistingFindingInfo {
    issueCommentId?: number;
    prCommentId?: number;
    prNumber?: number;
    resolved: boolean;
}
export type ExistingByFindingId = Record<string, ExistingFindingInfo>;
export interface BugbotPrContext {
    prHeadSha: string;
    prFiles: Array<{
        filename: string;
        status: string;
    }>;
    pathToFirstDiffLine: Record<string, number>;
}
/** Unresolved finding with full comment body (for intent prompt). */
export interface UnresolvedFindingWithBody {
    id: string;
    fullBody: string;
}
export interface BugbotContext {
    existingByFindingId: ExistingByFindingId;
    issueComments: Array<{
        id: number;
        body: string | null;
    }>;
    openPrNumbers: number[];
    previousFindingsBlock: string;
    prContext: BugbotPrContext | null;
    /** Unresolved findings with full body (issue or PR comment) for bugbot autofix intent. */
    unresolvedFindingsWithBody: UnresolvedFindingWithBody[];
}
