import * as github from "@actions/github";

export class Commit {
    get branchReference(): string {
        return github.context.payload.ref;
    }

    get branch(): string {
        return this.branchReference.replace('refs/heads/', '');
    }

    get commits(): any[] {
        return github.context.payload.commits || [];
    }
}