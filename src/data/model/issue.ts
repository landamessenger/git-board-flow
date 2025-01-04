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
        return github.context.payload.action === 'opened';
    }

    get labeled(): boolean {
        return github.context.payload.action === 'labeled';
    }

    get labelAdded(): string {
        return github.context.payload.label?.name;
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