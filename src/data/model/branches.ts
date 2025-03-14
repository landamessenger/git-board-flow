import * as github from "@actions/github";

export class Branches {
    main: string;
    development: string;
    featureTree: string;
    bugfixTree: string;
    hotfixTree: string;
    releaseTree: string;
    docsTree: string;
    choreTree: string;

    get defaultBranch(): string {
        return github.context.payload.repository?.default_branch ?? '';
    }

    constructor(
        main: string,
        development: string,
        featureTree: string,
        bugfixTree: string,
        hotfixTree: string,
        releaseTree: string,
        docsTree: string,
        choreTree: string,
    ) {
        this.main = main;
        this.development = development;
        this.featureTree = featureTree;
        this.bugfixTree = bugfixTree;
        this.hotfixTree = hotfixTree;
        this.releaseTree = releaseTree;
        this.docsTree = docsTree;
        this.choreTree = choreTree;
    }
}