export type UpdatePullRequestDescriptionParams = {
    projectContextInstruction: string;
    baseBranch: string;
    headBranch: string;
    issueNumber: string;
    issueDescription: string;
};
export declare function getUpdatePullRequestDescriptionPrompt(params: UpdatePullRequestDescriptionParams): string;
