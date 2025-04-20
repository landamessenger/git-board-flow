export declare class PullRequest {
    desiredAssigneesCount: number;
    desiredReviewersCount: number;
    mergeTimeout: number;
    inputs: any | undefined;
    get action(): string;
    get id(): string;
    get title(): string;
    get creator(): string;
    get number(): number;
    get url(): string;
    get body(): string;
    get head(): string;
    get base(): string;
    get isMerged(): boolean;
    get opened(): boolean;
    get isOpened(): boolean;
    get isClosed(): boolean;
    get isSynchronize(): boolean;
    get isPullRequest(): boolean;
    get isPullRequestReviewComment(): boolean;
    get commentId(): number;
    get commentBody(): string;
    get commentAuthor(): string;
    get commentUrl(): string;
    constructor(desiredAssigneesCount: number, desiredReviewersCount: number, mergeTimeout: number, inputs?: any | undefined);
}
