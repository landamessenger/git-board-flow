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
    prFiles: Array<{ filename: string; status: string }>;
    pathToFirstDiffLine: Record<string, number>;
}

export interface BugbotContext {
    existingByFindingId: ExistingByFindingId;
    issueComments: Array<{ id: number; body: string | null }>;
    openPrNumbers: number[];
    previousFindingsBlock: string;
    prContext: BugbotPrContext | null;
}
