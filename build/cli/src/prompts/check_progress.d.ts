export type CheckProgressParams = {
    projectContextInstruction: string;
    issueNumber: string;
    baseBranch: string;
    currentBranch: string;
    issueDescription: string;
};
export declare function getCheckProgressPrompt(params: CheckProgressParams): string;
