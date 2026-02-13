export type BugbotFixParams = {
    projectContextInstruction: string;
    owner: string;
    repo: string;
    headBranch: string;
    baseBranch: string;
    issueNumber: string;
    prNumberLine: string;
    findingsBlock: string;
    userComment: string;
    verifyBlock: string;
};
export declare function getBugbotFixPrompt(params: BugbotFixParams): string;
