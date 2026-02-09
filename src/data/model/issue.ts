import * as github from "@actions/github";

export class Issue {
    reopenOnPush: boolean;
    branchManagementAlways: boolean;
    desiredAssigneesCount: number;
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any -- GitHub payload shape */
    inputs: any | undefined = undefined;

    get title(): string {
        return this.inputs?.issue?.title ?? github.context.payload.issue?.title ?? '';
    }

    get number(): number {
        return this.inputs?.issue?.number ?? github.context.payload.issue?.number ?? -1;
    }

    get creator(): string {
        return this.inputs?.issue?.user?.login ?? github.context.payload.issue?.user.login ?? '';
    }

    get url(): string {
        return this.inputs?.issue?.html_url ?? github.context.payload.issue?.html_url ?? '';
    }

    get body(): string {
        return this.inputs?.issue?.body ?? github.context.payload.issue?.body ?? '';
    }

    get opened(): boolean {
        return ['opened', 'reopened'].includes(this.inputs?.action ?? github.context.payload.action ?? '');
    }

    get labeled(): boolean {
        return (this.inputs?.action ?? github.context.payload.action) === 'labeled';
    }

    get labelAdded(): string {
        return this.inputs?.label?.name ?? github.context.payload.label?.name ?? '';
    }

    get isIssue(): boolean {
        return (this.inputs?.eventName ?? github.context.eventName) === 'issues';
    }

    get isIssueComment(): boolean {
        return (this.inputs?.eventName ?? github.context.eventName) === 'issue_comment';
    }

    get commentId(): number {
        return this.inputs?.comment?.id ?? github.context.payload.comment?.id ?? -1;
    }

    get commentBody(): string {
        return this.inputs?.comment?.body ?? github.context.payload.comment?.body ?? '';
    }

    get commentAuthor(): string {
        return this.inputs?.comment?.user?.login ?? github.context.payload.comment?.user.login ?? '';
    }

    get commentUrl(): string {
        return this.inputs?.comment?.html_url ?? github.context.payload.comment?.html_url ?? '';
    }

    constructor(
        branchManagementAlways: boolean,
        reopenOnPush: boolean,
        desiredAssigneesCount: number,
        inputs: any | undefined = undefined, // eslint-disable-line @typescript-eslint/no-explicit-any
    ) {
        this.branchManagementAlways = branchManagementAlways;
        this.reopenOnPush = reopenOnPush;
        this.desiredAssigneesCount = desiredAssigneesCount;
        this.inputs = inputs;
    }
}