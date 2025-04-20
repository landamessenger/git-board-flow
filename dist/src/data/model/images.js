"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Images = void 0;
class Images {
    constructor(imagesOnIssue, imagesOnPullRequest, imagesOnCommit, cleanUpGifs, featureGifs, bugfixGifs, docsGifs, choreGifs, releaseGifs, hotfixGifs, prLinkGifs, prFeatureGifs, prBugfixGifs, prReleaseGifs, prHotfixGifs, prDocsGifs, prChoreGifs, commitAutomaticActions, commitFeatureGifs, commitBugfixGifs, commitReleaseGifs, commitHotfixGifs, commitDocsGifs, commitChoreGifs) {
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
exports.Images = Images;
