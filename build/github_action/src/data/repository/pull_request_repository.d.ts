export declare class PullRequestRepository {
    /**
     * Returns the list of open pull request numbers whose head branch equals the given branch.
     * Used to sync size/progress labels from the issue to PRs when they are updated on push.
     */
    getOpenPullRequestNumbersByHeadBranch: (owner: string, repository: string, headBranch: string, token: string) => Promise<number[]>;
    isLinked: (pullRequestUrl: string) => Promise<boolean>;
    updateBaseBranch: (owner: string, repository: string, pullRequestNumber: number, branch: string, token: string) => Promise<void>;
    updateDescription: (owner: string, repository: string, pullRequestNumber: number, description: string, token: string) => Promise<void>;
    getCurrentReviewers: (owner: string, repository: string, pullNumber: number, token: string) => Promise<string[]>;
    addReviewersToPullRequest: (owner: string, repository: string, pullNumber: number, reviewers: string[], token: string) => Promise<string[]>;
    getChangedFiles: (owner: string, repository: string, pullNumber: number, token: string) => Promise<{
        filename: string;
        status: string;
    }[]>;
    getPullRequestChanges: (owner: string, repository: string, pullNumber: number, token: string) => Promise<Array<{
        filename: string;
        status: string;
        additions: number;
        deletions: number;
        patch: string;
    }>>;
}
