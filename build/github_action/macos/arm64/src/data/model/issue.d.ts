export declare class Issue {
    reopenOnPush: boolean;
    branchManagementAlways: boolean;
    desiredAssigneesCount: number;
    inputs: any | undefined;
    get title(): string;
    get number(): number;
    get creator(): string;
    get url(): string;
    get body(): string;
    get opened(): boolean;
    get labeled(): boolean;
    get labelAdded(): string;
    get isIssue(): boolean;
    get isIssueComment(): boolean;
    get commentId(): number;
    get commentBody(): string;
    get commentAuthor(): string;
    get commentUrl(): string;
    constructor(branchManagementAlways: boolean, reopenOnPush: boolean, desiredAssigneesCount: number, inputs?: any | undefined);
}
