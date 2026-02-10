export declare class PullRequestRepository {
    /**
     * Returns the list of open pull request numbers whose head branch equals the given branch.
     * Used to sync size/progress labels from the issue to PRs when they are updated on push.
     */
    getOpenPullRequestNumbersByHeadBranch: (owner: string, repository: string, headBranch: string, token: string) => Promise<number[]>;
    isLinked: (pullRequestUrl: string) => Promise<boolean>;
    updateBaseBranch: (owner: string, repository: string, pullRequestNumber: number, branch: string, token: string) => Promise<void>;
    updateDescription: (owner: string, repository: string, pullRequestNumber: number, description: string, token: string) => Promise<void>;
    /**
     * Returns all users involved in review: requested (pending) + those who already submitted a review.
     * Used to avoid re-requesting someone who already reviewed when ensuring desired reviewer count.
     */
    getCurrentReviewers: (owner: string, repository: string, pullNumber: number, token: string) => Promise<string[]>;
    addReviewersToPullRequest: (owner: string, repository: string, pullNumber: number, reviewers: string[], token: string) => Promise<string[]>;
    getChangedFiles: (owner: string, repository: string, pullNumber: number, token: string) => Promise<{
        filename: string;
        status: string;
    }[]>;
    /** First line (right side) of the first hunk per file, for valid review comment placement. */
    private static firstLineFromPatch;
    /**
     * Returns for each changed file the first line number that appears in the diff (right side).
     * Used so review comments use a line that GitHub can resolve (avoids "line could not be resolved").
     */
    getFilesWithFirstDiffLine: (owner: string, repository: string, pullNumber: number, token: string) => Promise<Array<{
        path: string;
        firstLine: number;
    }>>;
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
     * Includes node_id for GraphQL (e.g. resolve review thread).
     */
    listPullRequestReviewComments: (owner: string, repository: string, pullNumber: number, token: string) => Promise<Array<{
        id: number;
        body: string | null;
        path?: string;
        line?: number;
        node_id?: string;
    }>>;
    /**
     * Resolve a PR review thread (GraphQL only). Finds the thread that contains the given comment and marks it resolved.
     * Uses repository.pullRequest.reviewThreads because the field pullRequestReviewThread on PullRequestReviewComment was removed from the API.
     * Paginates through all threads and all comments in each thread so the comment is found regardless of PR size.
     * No-op if thread is already resolved. Logs and does not throw on error.
     */
    resolvePullRequestReviewThread: (owner: string, repository: string, pullNumber: number, commentNodeId: string, token: string) => Promise<void>;
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
