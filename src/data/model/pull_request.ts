import * as github from "@actions/github";

export class PullRequest {
    desiredAssigneesCount: number;
    desiredReviewersCount: number;
    mergeTimeout: number;
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any -- GitHub payload shape */
    inputs: any | undefined = undefined;

    get action(): string {
        return this.inputs?.action ?? github.context.payload.action ?? '';
    }

    get id(): string {
        return this.inputs?.pull_request?.node_id ?? github.context.payload.pull_request?.node_id ?? '';
    }

    get title(): string {
        return this.inputs?.pull_request?.title ?? github.context.payload.pull_request?.title ?? '';
    }

    get creator(): string {
        return this.inputs?.pull_request?.user?.login ?? github.context.payload.pull_request?.user.login ?? '';
    }

    get number(): number {
        return this.inputs?.pull_request?.number ?? github.context.payload.pull_request?.number ?? -1;
    }

    get url(): string {
        return this.inputs?.pull_request?.html_url ?? github.context.payload.pull_request?.html_url ?? '';
    }

    get body(): string {
        return this.inputs?.pull_request?.body ?? github.context.payload.pull_request?.body ?? '';
    }

    get head(): string {
        return this.inputs?.pull_request?.head?.ref ?? github.context.payload.pull_request?.head.ref ?? '';
    }

    get base(): string {
        return this.inputs?.pull_request?.base?.ref ?? github.context.payload.pull_request?.base.ref ?? '';
    }

    get isMerged(): boolean {
        return this.inputs?.pull_request?.merged ?? github.context.payload.pull_request?.merged ?? false;
    }

    get opened(): boolean {
        return ['opened', 'reopened'].includes(this.inputs?.action ?? github.context.payload.action ?? '');
    }

    get isOpened(): boolean {
        return (this.inputs?.pull_request?.state ?? github.context.payload.pull_request?.state) === 'open'
            && this.action !== 'closed';
    }

    get isClosed(): boolean {
        return (this.inputs?.pull_request?.state ?? github.context.payload.pull_request?.state) === 'closed'
            || this.action === 'closed';
    }

    get isSynchronize(): boolean {
        return this.action === 'synchronize';
    }

    get isPullRequest(): boolean {
        return (this.inputs?.eventName ?? github.context.eventName) === 'pull_request';
    }

    get isPullRequestReviewComment(): boolean {
        return (this.inputs?.eventName ?? github.context.eventName) === 'pull_request_review_comment';
    }

    /** Review comment: GitHub sends it as payload.comment for pull_request_review_comment event. */
    private get reviewCommentPayload(): { id?: number; body?: string; user?: { login?: string }; html_url?: string; in_reply_to_id?: number } | undefined {
        const p = github.context.payload as {
            comment?: { id?: number; body?: string; user?: { login?: string }; html_url?: string; in_reply_to_id?: number };
            pull_request_review_comment?: { id?: number; body?: string; user?: { login?: string }; html_url?: string; in_reply_to_id?: number };
        };
        return this.inputs?.pull_request_review_comment ?? this.inputs?.comment ?? p.pull_request_review_comment ?? p.comment;
    }

    get commentId(): number {
        return this.reviewCommentPayload?.id ?? -1;
    }

    get commentBody(): string {
        return this.reviewCommentPayload?.body ?? '';
    }

    get commentAuthor(): string {
        return this.reviewCommentPayload?.user?.login ?? '';
    }

    get commentUrl(): string {
        return this.reviewCommentPayload?.html_url ?? '';
    }

    /** When the comment is a reply, the id of the parent review comment (for bugbot: include parent body in intent prompt). */
    get commentInReplyToId(): number | undefined {
        const raw = this.reviewCommentPayload?.in_reply_to_id;
        return raw != null ? Number(raw) : undefined;
    }

    constructor(
        desiredAssigneesCount: number,
        desiredReviewersCount: number,
        mergeTimeout: number,
        inputs: any | undefined = undefined, // eslint-disable-line @typescript-eslint/no-explicit-any
    ) {
        this.desiredAssigneesCount = desiredAssigneesCount;
        this.desiredReviewersCount = desiredReviewersCount;
        this.mergeTimeout = mergeTimeout;
        this.inputs = inputs;
    }
}