import * as github from "@actions/github";
import { logDebugInfo, logError } from "../../utils/logger";

export class PullRequestRepository {

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

        try {
            const { data: filesData } = await octokit.rest.pulls.listFiles({
                owner,
                repo: repository,
                pull_number: pullNumber,
            });

            return filesData.map((file) => ({
                filename: file.filename,
                status: file.status,
                additions: file.additions,
                deletions: file.deletions,
                patch: file.patch || ''
            }));
        } catch (error) {
            logError(`Error getting pull request changes: ${error}.`);
            return [];
        }
    };

}