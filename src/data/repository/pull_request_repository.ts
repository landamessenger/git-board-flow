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

    getCurrentReviewers = async (
        owner: string,
        repository: string,
        pullNumber: number,
        token: string
    ): Promise<string[]> => {
        const octokit = github.getOctokit(token);

        try {
            const {data} = await octokit.rest.pulls.listRequestedReviewers({
                owner,
                repo: repository,
                pull_number: pullNumber,
            });

            return data.users.map((user) => user.login);
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
     * List review comments on a PR (for bugbot: find existing findings by marker).
     */
    listPullRequestReviewComments = async (
        owner: string,
        repository: string,
        pullNumber: number,
        token: string
    ): Promise<Array<{ id: number; body: string | null; path?: string; line?: number }>> => {
        const octokit = github.getOctokit(token);
        try {
            const { data } = await octokit.rest.pulls.listReviewComments({
                owner,
                repo: repository,
                pull_number: pullNumber,
            });
            return (data || []).map((c) => ({
                id: c.id,
                body: c.body ?? null,
                path: c.path,
                line: c.line ?? undefined,
            }));
        } catch (error) {
            logError(`Error listing PR review comments: ${error}.`);
            return [];
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
        for (const c of comments) {
            await octokit.rest.pulls.createReviewComment({
                owner,
                repo: repository,
                pull_number: pullNumber,
                commit_id: commitId,
                path: c.path,
                line: c.line,
                body: c.body,
            });
        }
        logDebugInfo(`Created ${comments.length} review comment(s) on PR #${pullNumber}.`);
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