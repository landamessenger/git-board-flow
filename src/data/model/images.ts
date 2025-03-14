export class Images {
    issueAutomaticActions: string[];
    issueFeatureGifs: string[];
    issueBugfixGifs: string[];
    issueReleaseGifs: string[];
    issueHotfixGifs: string[];
    issueDocsGifs: string[];
    issueChoreGifs: string[];
    pullRequestAutomaticActions: string[];

    constructor(
        cleanUpGifs: string[],
        featureGifs: string[],
        bugfixGifs: string[],
        docsGifs: string[],
        choreGifs: string[],
        releaseGifs: string[],
        hotfixGifs: string[],
        prLinkGifs: string[],
    ) {
        this.issueAutomaticActions = cleanUpGifs;
        this.issueFeatureGifs = featureGifs;
        this.issueBugfixGifs = bugfixGifs;
        this.issueReleaseGifs = releaseGifs;
        this.issueHotfixGifs = hotfixGifs;
        this.issueDocsGifs = docsGifs;
        this.issueChoreGifs = choreGifs;
        this.pullRequestAutomaticActions = prLinkGifs;
    }
}