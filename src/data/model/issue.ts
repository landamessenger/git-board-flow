import * as github from "@actions/github";

export class Issue {
    reopenOnPush: boolean;
    branchManagementAlways: boolean;
    desiredAssigneesCount: number;

    get title(): string {
        return github.context.payload.issue?.title ?? '';
    }

    get number(): number {
        return github.context.payload.issue?.number ?? -1;
    }

    get creator(): string {
        return github.context.payload.issue?.user.login ?? '';
    }

    get url(): string {
        return github.context.payload.issue?.html_url ?? '';
    }

    get body(): string {
        return github.context.payload.issue?.body ?? '';
    }

    get opened(): boolean {
        return ['opened', 'reopened'].includes(github.context.payload.action || '');
    }

    get labeled(): boolean {
        return github.context.payload.action === 'labeled';
    }

    get labelAdded(): string {
        return github.context.payload.label?.name;
    }

    get isIssue(): boolean {
        return github.context.eventName === 'issues';
    }

    get isIssueComment(): boolean {
        return github.context.eventName === 'issue_comment';
    }

    get commentId(): number {
        return github.context.payload.comment?.id ?? -1;
    }

    get commentBody(): string {
        return github.context.payload.comment?.body ?? '';
    }

    get commentAuthor(): string {
        return github.context.payload.comment?.user.login ?? '';
    }

    get commentUrl(): string {
        return github.context.payload.comment?.html_url ?? '';
    }

    constructor(
        branchManagementAlways: boolean,
        reopenOnPush: boolean,
        desiredAssigneesCount: number,
    ) {
        this.branchManagementAlways = branchManagementAlways;
        this.reopenOnPush = reopenOnPush;
        this.desiredAssigneesCount = desiredAssigneesCount;
    }
}