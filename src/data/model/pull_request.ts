import * as github from "@actions/github";

export class PullRequest {
    desiredAssigneesCount: number;
    desiredReviewersCount: number;
    mergeTimeout: number;

    get action(): string {
        return github.context.payload.action ?? '';
    }

    get id(): string {
        return github.context.payload.pull_request?.node_id ?? '';
    }

    get title(): string {
        return github.context.payload.pull_request?.title ?? '';
    }

    get creator(): string {
        return github.context.payload.pull_request?.user.login ?? '';
    }

    get number(): number {
        return github.context.payload.pull_request?.number ?? -1;
    }

    get url(): string {
        return github.context.payload.pull_request?.html_url ?? '';
    }

    get body(): string {
        return github.context.payload.pull_request?.body ?? '';
    }

    get head(): string {
        return github.context.payload.pull_request?.head.ref ?? '';
    }

    get base(): string {
        return github.context.payload.pull_request?.base.ref ?? '';
    }

    get isMerged(): boolean {
        return github.context.payload.pull_request?.merged ?? false;
    }

    get opened(): boolean {
        return ['opened', 'reopened'].includes(github.context.payload.action || '');
    }

    get isOpened(): boolean {
        return github.context.payload.pull_request?.state === 'open'
            && this.action !== 'closed';
    }

    get isClosed(): boolean {
        return github.context.payload.pull_request?.state === 'closed'
            || this.action === 'closed';
    }

    get isSynchronize(): boolean {
        return this.action === 'synchronize';
    }

    get isPullRequest(): boolean {
        return github.context.eventName === 'pull_request';
    }

    get isPullRequestReviewComment(): boolean {
        return github.context.eventName === 'pull_request_review_comment';
    }

    get commentId(): number {
        return github.context.payload.pull_request_review_comment?.id ?? -1;
    }

    get commentBody(): string {
        return github.context.payload.pull_request_review_comment?.body ?? '';
    }

    get commentAuthor(): string {
        return github.context.payload.pull_request_review_comment?.user.login ?? '';
    }

    get commentUrl(): string {
        return github.context.payload.pull_request_review_comment?.html_url ?? '';
    }

    constructor(
        desiredAssigneesCount: number,
        desiredReviewersCount: number,
        mergeTimeout: number,
    ) {
        this.desiredAssigneesCount = desiredAssigneesCount;
        this.desiredReviewersCount = desiredReviewersCount;
        this.mergeTimeout = mergeTimeout;
    }
}