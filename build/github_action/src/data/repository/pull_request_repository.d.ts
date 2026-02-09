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
    /** Head commit SHA of the PR (for creating review). */
    getPullRequestHeadSha: (owner: string, repository: string, pullNumber: number, token: string) => Promise<string | undefined>;
    /**
     * List all review comments on a PR (for bugbot: find existing findings by marker).
     * Uses pagination to fetch every comment (default API returns only 30 per page).
     */
    listPullRequestReviewComments: (owner: string, repository: string, pullNumber: number, token: string) => Promise<Array<{
        id: number;
        body: string | null;
        path?: string;
        line?: number;
    }>>;
    /**
     * Create a review on the PR with one or more inline comments (bugbot findings).
     * Each comment requires path and line (use first file and line 1 if not specified).
     */
    createReviewWithComments: (owner: string, repository: string, pullNumber: number, commitId: string, comments: Array<{
        path: string;
        line: number;
        body: string;
    }>, token: string) => Promise<void>;
    /** Update an existing PR review comment (e.g. to mark finding as resolved in body). */
    updatePullRequestReviewComment: (owner: string, repository: string, commentId: number, body: string, token: string) => Promise<void>;
}
