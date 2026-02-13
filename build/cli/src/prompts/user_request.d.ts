export type UserRequestParams = {
    projectContextInstruction: string;
    owner: string;
    repo: string;
    headBranch: string;
    baseBranch: string;
    issueNumber: string;
    userComment: string;
};
export declare function getUserRequestPrompt(params: UserRequestParams): string;
