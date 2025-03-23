export class Images {
    imagesOnIssue: boolean;
    issueAutomaticActions: string[];
    issueFeatureGifs: string[];
    issueBugfixGifs: string[];
    issueReleaseGifs: string[];
    issueHotfixGifs: string[];
    issueDocsGifs: string[];
    issueChoreGifs: string[];

    imagesOnPullRequest: boolean;
    pullRequestAutomaticActions: string[];
    pullRequestFeatureGifs: string[];
    pullRequestBugfixGifs: string[];
    pullRequestReleaseGifs: string[];
    pullRequestHotfixGifs: string[];
    pullRequestDocsGifs: string[];
    pullRequestChoreGifs: string[];

    imagesOnCommit: boolean;
    commitAutomaticActions: string[];
    commitFeatureGifs: string[];
    commitBugfixGifs: string[];
    commitReleaseGifs: string[];
    commitHotfixGifs: string[];
    commitDocsGifs: string[];
    commitChoreGifs: string[];

    constructor(
        imagesOnIssue: boolean,
        imagesOnPullRequest: boolean,
        imagesOnCommit: boolean,
        cleanUpGifs: string[],
        featureGifs: string[],
        bugfixGifs: string[],
        docsGifs: string[],
        choreGifs: string[],
        releaseGifs: string[],
        hotfixGifs: string[],
        prLinkGifs: string[],
        prFeatureGifs: string[],
        prBugfixGifs: string[],
        prReleaseGifs: string[],
        prHotfixGifs: string[],
        prDocsGifs: string[],
        prChoreGifs: string[],
        commitAutomaticActions: string[],
        commitFeatureGifs: string[],
        commitBugfixGifs: string[],
        commitReleaseGifs: string[],
        commitHotfixGifs: string[],
        commitDocsGifs: string[],
        commitChoreGifs: string[],
    ) {
        this.imagesOnIssue = imagesOnIssue;
        this.imagesOnPullRequest = imagesOnPullRequest;
        this.imagesOnCommit = imagesOnCommit;
        this.issueAutomaticActions = cleanUpGifs;
        this.issueFeatureGifs = featureGifs;
        this.issueBugfixGifs = bugfixGifs;
        this.issueReleaseGifs = releaseGifs;
        this.issueHotfixGifs = hotfixGifs;
        this.issueDocsGifs = docsGifs;
        this.issueChoreGifs = choreGifs;
        this.pullRequestAutomaticActions = prLinkGifs;
        this.pullRequestFeatureGifs = prFeatureGifs;
        this.pullRequestBugfixGifs = prBugfixGifs;
        this.pullRequestReleaseGifs = prReleaseGifs;
        this.pullRequestHotfixGifs = prHotfixGifs;
        this.pullRequestDocsGifs = prDocsGifs;
        this.pullRequestChoreGifs = prChoreGifs;
        this.commitAutomaticActions = commitAutomaticActions;
        this.commitFeatureGifs = commitFeatureGifs;
        this.commitBugfixGifs = commitBugfixGifs;
        this.commitReleaseGifs = commitReleaseGifs;
        this.commitHotfixGifs = commitHotfixGifs;
        this.commitDocsGifs = commitDocsGifs;
        this.commitChoreGifs = commitChoreGifs;
    }
}