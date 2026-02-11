import * as github from "@actions/github";
import { logDebugInfo, logError } from "../../utils/logger";

export class PullRequestRepository {

    /**
     * Returns the list of open pull request numbers whose head branch equals the given branch.
     * Used to sync size/progress labels from the issue to PRs when they are updated on push.
     */
    getOpenPullRequestNumbersByHeadBranch = async (
        owner: string,
        repository: string,
        headBranch: string,
        token: string,
    ): Promise<number[]> => {
        const octokit = github.getOctokit(token);
        try {
            const { data } = await octokit.rest.pulls.list({
                owner,
                repo: repository,
                state: 'open',
                head: `${owner}:${headBranch}`,
            });
            const numbers = (data || []).map((pr) => pr.number);
            logDebugInfo(`Found ${numbers.length} open PR(s) for head branch "${headBranch}": ${numbers.join(', ') || 'none'}`);
            return numbers;
        } catch (error) {
            logError(`Error listing PRs for branch ${headBranch}: ${error}`);
            return [];
        }
    };

    /**
     * Returns the head branch of the first open PR that references the given issue number
     * (e.g. body contains "#123" or head ref contains "123" as in feature/123-...).
     * Used for issue_comment events where commit.branch is empty.
     */
    getHeadBranchForIssue = async (
        owner: string,
        repository: string,
        issueNumber: number,
        token: string
    ): Promise<string | undefined> => {
        const octokit = github.getOctokit(token);
        const issueRef = `#${issueNumber}`;
        const issueNumStr = String(issueNumber);
        try {
            const { data } = await octokit.rest.pulls.list({
                owner,
                repo: repository,
                state: 'open',
                per_page: 100,
            });
            for (const pr of data || []) {
                const body = pr.body ?? '';
                const headRef = pr.head?.ref ?? '';
                if (
                    body.includes(issueRef) ||
                    headRef.includes(issueNumStr)
                ) {
                    logDebugInfo(`Found head branch "${headRef}" for issue #${issueNumber} (PR #${pr.number}).`);
                    return headRef;
                }
            }
            logDebugInfo(`No open PR referencing issue #${issueNumber} found.`);
            return undefined;
        } catch (error) {
            logError(`Error getting head branch for issue #${issueNumber}: ${error}`);
            return undefined;
        }
    };

    isLinked = async (pullRequestUrl: string) => {
        const htmlContent = await fetch(pullRequestUrl).then(res => res.text());
        return !htmlContent.includes('has_github_issues=false');
    }

    updateBaseBranch = async (
        owner: string,
        repository: string,
        pullRequestNumber: number,
        branch: string,
        token: string,
    ) => {
        const octokit = github.getOctokit(token);
        await octokit.rest.pulls.update({
            owner: owner,
            repo: repository,
            pull_number: pullRequestNumber,
            base: branch,
        });

        logDebugInfo(`Changed base branch to ${branch}`);
    }

    updateDescription = async (
        owner: string,
        repository: string,
        pullRequestNumber: number,
        description: string,
        token: string,
    ) => {
        const octokit = github.getOctokit(token);
        await octokit.rest.pulls.update({
            owner: owner,
            repo: repository,
            pull_number: pullRequestNumber,
            body: description,
        });

        logDebugInfo(`Updated PR #${pullRequestNumber} description with: ${description}`);
    }

    /**
     * Returns all users involved in review: requested (pending) + those who already submitted a review.
     * Used to avoid re-requesting someone who already reviewed when ensuring desired reviewer count.
     */
    getCurrentReviewers = async (
        owner: string,
        repository: string,
        pullNumber: number,
        token: string
    ): Promise<string[]> => {
        const octokit = github.getOctokit(token);

        try {
            const [requestedRes, reviewsRes] = await Promise.all([
                octokit.rest.pulls.listRequestedReviewers({
                    owner,
                    repo: repository,
                    pull_number: pullNumber,
                }),
                octokit.rest.pulls.listReviews({
                    owner,
                    repo: repository,
                    pull_number: pullNumber,
                }),
            ]);

            const logins = new Set<string>();
            for (const user of requestedRes.data.users) {
                logins.add(user.login);
            }
            for (const review of reviewsRes.data) {
                if (review.user?.login) {
                    logins.add(review.user.login);
                }
            }
            return Array.from(logins);
        } catch (error) {
            logError(`Error getting reviewers of PR: ${error}.`);
            return [];
        }
    };

    addReviewersToPullRequest = async (
        owner: string,
        repository: string,
        pullNumber: number,
        reviewers: string[],
        token: string
    ): Promise<string[]> => {
        const octokit = github.getOctokit(token);

        try {
            if (reviewers.length === 0) {
                logDebugInfo(`No reviewers provided for addition. Skipping operation.`);
                return [];
            }

            const {data} = await octokit.rest.pulls.requestReviewers({
                owner,
                repo: repository,
                pull_number: pullNumber,
                reviewers: reviewers,
            });

            const addedReviewers = data.requested_reviewers || [];
            return addedReviewers.map((reviewer) => reviewer.login);
        } catch (error) {
            logError(`Error adding reviewers to pull request: ${error}.`);
            return [];
        }
    };

    getChangedFiles = async (
        owner: string,
        repository: string,
        pullNumber: number,
        token: string
    ): Promise<{filename: string, status: string}[]> => {
        const octokit = github.getOctokit(token);

        try {
            const {data} = await octokit.rest.pulls.listFiles({
                owner,
                repo: repository,
                pull_number: pullNumber,
            });

            return data.map((file) => ({
                filename: file.filename,
                status: file.status
            }));
        } catch (error) {
            logError(`Error getting changed files from pull request: ${error}.`);
            return [];
        }
    };

    /** First line (right side) of the first hunk per file, for valid review comment placement. */
    private static firstLineFromPatch(patch: string): number | undefined {
        const match = patch.match(/^@@ -\d+,\d+ \+(\d+),\d+ @@/m);
        return match ? parseInt(match[1], 10) : undefined;
    }

    /**
     * Returns for each changed file the first line number that appears in the diff (right side).
     * Used so review comments use a line that GitHub can resolve (avoids "line could not be resolved").
     */
    getFilesWithFirstDiffLine = async (
        owner: string,
        repository: string,
        pullNumber: number,
        token: string
    ): Promise<Array<{ path: string; firstLine: number }>> => {
        const octokit = github.getOctokit(token);
        try {
            const { data } = await octokit.rest.pulls.listFiles({
                owner,
                repo: repository,
                pull_number: pullNumber,
            });
            return (data || [])
                .filter((f) => f.status !== 'removed' && (f.patch ?? '').length > 0)
                .map((f) => {
                    const firstLine = PullRequestRepository.firstLineFromPatch(f.patch ?? '');
                    return { path: f.filename, firstLine: firstLine ?? 1 };
                });
        } catch (error) {
            logError(`Error getting files with diff lines (owner=${owner}, repo=${repository}, pullNumber=${pullNumber}): ${error}.`);
            return [];
        }
    };

    getPullRequestChanges = async (
        owner: string,
        repository: string,
        pullNumber: number,
        token: string
    ): Promise<Array<{
        filename: string,
        status: string,
        additions: number,
        deletions: number,
        patch: string
    }>> => {
        const octokit = github.getOctokit(token);
        const allFiles = [];

        try {
            for await (const response of octokit.paginate.iterator(octokit.rest.pulls.listFiles, {
                owner,
                repo: repository,
                pull_number: pullNumber,
                per_page: 100
            })) {
                const filesData = response.data;
                allFiles.push(...filesData.map((file) => ({
                    filename: file.filename,
                    status: file.status,
                    additions: file.additions,
                    deletions: file.deletions,
                    patch: file.patch || ''
                })));
            }

            return allFiles;
        } catch (error) {
            logError(`Error getting pull request changes: ${error}.`);
            return [];
        }
    };

    /** Head commit SHA of the PR (for creating review). */
    getPullRequestHeadSha = async (
        owner: string,
        repository: string,
        pullNumber: number,
        token: string
    ): Promise<string | undefined> => {
        const octokit = github.getOctokit(token);
        try {
            const { data } = await octokit.rest.pulls.get({
                owner,
                repo: repository,
                pull_number: pullNumber,
            });
            return data.head?.sha;
        } catch (error) {
            logError(`Error getting PR head SHA: ${error}.`);
            return undefined;
        }
    };

    /**
     * List all review comments on a PR (for bugbot: find existing findings by marker).
     * Uses pagination to fetch every comment (default API returns only 30 per page).
     * Includes node_id for GraphQL (e.g. resolve review thread).
     */
    listPullRequestReviewComments = async (
        owner: string,
        repository: string,
        pullNumber: number,
        token: string
    ): Promise<Array<{ id: number; body: string | null; path?: string; line?: number; node_id?: string }>> => {
        const octokit = github.getOctokit(token);
        const all: Array<{ id: number; body: string | null; path?: string; line?: number; node_id?: string }> = [];
        try {
            for await (const response of octokit.paginate.iterator(octokit.rest.pulls.listReviewComments, {
                owner,
                repo: repository,
                pull_number: pullNumber,
                per_page: 100,
            })) {
                const data = response.data || [];
                all.push(
                    ...data.map((c: { id: number; body: string | null; path?: string; line?: number; node_id?: string }) => ({
                        id: c.id,
                        body: c.body ?? null,
                        path: c.path,
                        line: c.line ?? undefined,
                        node_id: c.node_id ?? undefined,
                    }))
                );
            }
            return all;
        } catch (error) {
            logError(`Error listing PR review comments (owner=${owner}, repo=${repository}, pullNumber=${pullNumber}): ${error}.`);
            return [];
        }
    };

    /**
     * Fetches a single PR review comment by id (e.g. parent comment when user replied in thread).
     * Returns the comment body or null if not found.
     */
    getPullRequestReviewCommentBody = async (
        owner: string,
        repository: string,
        _pullNumber: number,
        commentId: number,
        token: string
    ): Promise<string | null> => {
        const octokit = github.getOctokit(token);
        try {
            const { data } = await octokit.rest.pulls.getReviewComment({
                owner,
                repo: repository,
                comment_id: commentId,
            });
            return data.body ?? null;
        } catch (error) {
            logError(`Error getting PR review comment ${commentId}: ${error}`);
            return null;
        }
    };

    /**
     * Resolve a PR review thread (GraphQL only). Finds the thread that contains the given comment and marks it resolved.
     * Uses repository.pullRequest.reviewThreads because the field pullRequestReviewThread on PullRequestReviewComment was removed from the API.
     * Paginates through all threads and all comments in each thread so the comment is found regardless of PR size.
     * No-op if thread is already resolved. Logs and does not throw on error.
     */
    resolvePullRequestReviewThread = async (
        owner: string,
        repository: string,
        pullNumber: number,
        commentNodeId: string,
        token: string
    ): Promise<void> => {
        const octokit = github.getOctokit(token);
        try {
            type ThreadNode = {
                id: string;
                comments: { nodes: Array<{ id: string }>; pageInfo: { hasNextPage: boolean; endCursor: string | null } };
            };
            type ThreadsResult = {
                repository?: {
                    pullRequest?: {
                        reviewThreads?: {
                            nodes: ThreadNode[];
                            pageInfo: { hasNextPage: boolean; endCursor: string | null };
                        };
                    };
                };
            };
            type ThreadCommentsResult = {
                node?: {
                    comments: { nodes: Array<{ id: string }>; pageInfo: { hasNextPage: boolean; endCursor: string | null } };
                };
            };

            let threadId: string | null = null;
            let threadsCursor: string | null = null;

            outer: do {
                const threadsData: ThreadsResult = await octokit.graphql<ThreadsResult>(
                    `query ($owner: String!, $repo: String!, $prNumber: Int!, $threadsAfter: String) {
                        repository(owner: $owner, name: $repo) {
                            pullRequest(number: $prNumber) {
                                reviewThreads(first: 100, after: $threadsAfter) {
                                    nodes {
                                        id
                                        comments(first: 100) {
                                            nodes { id }
                                            pageInfo { hasNextPage endCursor }
                                        }
                                    }
                                    pageInfo { hasNextPage endCursor }
                                }
                            }
                        }
                    }`,
                    { owner, repo: repository, prNumber: pullNumber, threadsAfter: threadsCursor }
                );
                const threads = threadsData?.repository?.pullRequest?.reviewThreads as
                    | { nodes: ThreadNode[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } }
                    | undefined;
                if (!threads?.nodes?.length) break;

                for (const thread of threads.nodes) {
                    let commentsCursor: string | null = null;
                    let commentNodes = thread.comments?.nodes ?? [];
                    let commentsPageInfo = thread.comments?.pageInfo;

                    do {
                        if (commentNodes.some((c: { id: string }) => c.id === commentNodeId)) {
                            threadId = thread.id;
                            break outer;
                        }
                        if (!commentsPageInfo?.hasNextPage || commentsPageInfo.endCursor == null) break;
                        commentsCursor = commentsPageInfo.endCursor;
                        const nextComments = await octokit.graphql<ThreadCommentsResult>(
                            `query ($threadId: ID!, $commentsAfter: String) {
                                node(id: $threadId) {
                                    ... on PullRequestReviewThread {
                                        comments(first: 100, after: $commentsAfter) {
                                            nodes { id }
                                            pageInfo { hasNextPage endCursor }
                                        }
                                    }
                                }
                            }`,
                            { threadId: thread.id, commentsAfter: commentsCursor }
                        );
                        commentNodes = nextComments?.node?.comments?.nodes ?? [];
                        commentsPageInfo = nextComments?.node?.comments?.pageInfo ?? { hasNextPage: false, endCursor: null };
                    } while (commentsPageInfo?.hasNextPage === true && commentsPageInfo?.endCursor != null);
                }

                const pageInfo: { hasNextPage: boolean; endCursor: string | null } = threads.pageInfo;
                if (threadId != null || !pageInfo?.hasNextPage) break;
                threadsCursor = pageInfo.endCursor ?? null;
            } while (threadsCursor != null);

            if (!threadId) {
                logError(`[Bugbot] No review thread found for comment node_id=${commentNodeId}.`);
                return;
            }
            await octokit.graphql<{ resolveReviewThread?: { thread?: { id: string } } }>(
                `mutation ($threadId: ID!) {
                    resolveReviewThread(input: { threadId: $threadId }) {
                        thread { id }
                    }
                }`,
                { threadId }
            );
            logDebugInfo(`Resolved PR review thread ${threadId}.`);
        } catch (err) {
            logError(`[Bugbot] Error resolving PR review thread (commentNodeId=${commentNodeId}, owner=${owner}, repo=${repository}): ${err}`);
        }
    };

    /**
     * Create a review on the PR with one or more inline comments (bugbot findings).
     * Each comment requires path and line (use first file and line 1 if not specified).
     */
    createReviewWithComments = async (
        owner: string,
        repository: string,
        pullNumber: number,
        commitId: string,
        comments: Array<{ path: string; line: number; body: string }>,
        token: string
    ): Promise<void> => {
        if (comments.length === 0) return;
        const octokit = github.getOctokit(token);
        const results = await Promise.allSettled(
            comments.map((c) =>
                octokit.rest.pulls.createReviewComment({
                    owner,
                    repo: repository,
                    pull_number: pullNumber,
                    commit_id: commitId,
                    path: c.path,
                    line: c.line,
                    side: 'RIGHT',
                    body: c.body,
                })
            )
        );
        let created = 0;
        results.forEach((result, i) => {
            if (result.status === 'fulfilled') {
                created += 1;
            } else {
                const c = comments[i];
                logError(
                    `[Bugbot] Error creating PR review comment. path="${c.path}", line=${c.line}, prNumber=${pullNumber}, owner=${owner}, repo=${repository}: ${result.reason}`
                );
            }
        });
        if (created > 0) {
            logDebugInfo(`Created ${created} review comment(s) on PR #${pullNumber}.`);
        }
    };

    /** Update an existing PR review comment (e.g. to mark finding as resolved in body). */
    updatePullRequestReviewComment = async (
        owner: string,
        repository: string,
        commentId: number,
        body: string,
        token: string
    ): Promise<void> => {
        const octokit = github.getOctokit(token);
        await octokit.rest.pulls.updateReviewComment({
            owner,
            repo: repository,
            comment_id: commentId,
            body,
        });
        logDebugInfo(`Updated review comment ${commentId}.`);
    };
}