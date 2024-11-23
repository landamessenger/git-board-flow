import * as github from "@actions/github";

export class Branches {
    main: string;
    development: string;
    replacedBranch: string | undefined;

    get defaultBranch(): string {
        return github.context.payload.repository?.default_branch ?? '';
    }

    constructor(
        main: string,
        development: string,
    ) {
        this.main = main;
        this.development = development;
    }
}