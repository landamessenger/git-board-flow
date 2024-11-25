import * as github from "@actions/github";

export class Commit {

    get branch(): string {
        return github.context.payload.ref.replace('refs/heads/', '');
    }

    get commits(): any[] {
        return github.context.payload.commits || [];
    }
}