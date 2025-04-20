import * as github from "@actions/github";

export class Commit {
    private inputs: any | undefined = undefined;

    constructor(inputs: any | undefined = undefined) {
        this.inputs = inputs;
    }
    
    get branchReference(): string {
        return this.inputs?.commits?.ref ?? github.context.payload.ref ?? '';
    }

    get branch(): string {
        return this.branchReference.replace('refs/heads/', '');
    }

    get commits(): any[] {
        return github.context.payload.commits || [];
    }
}