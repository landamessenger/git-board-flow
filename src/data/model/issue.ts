import * as github from "@actions/github";

export class Issue {
    get title(): string {
        return github.context.payload.issue?.title ?? '';
    }

    get number(): number {
        return github.context.payload.issue?.number ?? -1;
    }

    get url(): string {
        return github.context.payload.issue?.html_url ?? '';
    }

    get body(): string {
        return github.context.payload.issue?.body ?? '';
    }
}