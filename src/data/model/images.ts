export class Images {
    issueAutomaticActions: string[];
    issueFeatureGifs: string[];
    issueBugfixGifs: string[];
    issueReleaseGifs: string[];
    issueHotfixGifs: string[];
    pullRequestAutomaticActions: string[];

    constructor(
        cleanUpGifs: string[],
        featureGifs: string[],
        bugfixGifs: string[],
        releaseGifs: string[],
        hotfixGifs: string[],
        prLinkGifs: string[],
    ) {
        this.issueAutomaticActions = cleanUpGifs;
        this.issueFeatureGifs = featureGifs;
        this.issueBugfixGifs = bugfixGifs;
        this.issueReleaseGifs = releaseGifs;
        this.issueHotfixGifs = hotfixGifs;
        this.pullRequestAutomaticActions = prLinkGifs;
    }
}