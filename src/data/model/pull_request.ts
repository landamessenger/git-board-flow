import * as github from "@actions/github";

export class PullRequest {
    get id(): string {
        return github.context.payload.pull_request?.node_id ?? '';
    }

    get title(): string {
        return github.context.payload.pull_request?.title ?? '';
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
}