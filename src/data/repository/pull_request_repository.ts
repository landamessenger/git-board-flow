import * as github from "@actions/github";
import * as core from "@actions/core";

export class PullRequestRepository {

    extractIssueNumberFromBranch = async (): Promise<number> => {
        const branchName = github.context.payload.pull_request?.head.ref;
        const match = branchName?.match(/[a-zA-Z]+\/([0-9]+)-.*/);

        if (match) {
            return parseInt(match[1])
        } else {
            throw new Error(`No issue number found in branch name: ${branchName}`);
        }
    }

    isLinked = async () => {
        const prUrl = github.context.payload.pull_request?.html_url;
        if (!prUrl) {
            throw new Error('Pull Request URL not found.');
        }

        core.info(`Fetching PR URL: ${prUrl}`);
        const htmlContent = await fetch(prUrl).then(res => res.text());
        const isLinked = !htmlContent.includes('has_github_issues=false');
        core.exportVariable('is_linked', isLinked.toString());

        core.info(`Is PR linked to an issue? ${isLinked}`);
        return isLinked;
    }

    updateBaseBranch = async (token: string, branch: string) => {
        const prNumber = github.context.payload.pull_request?.number;

        if (!prNumber) {
            throw new Error('PR number not found.');
        }

        const octokit = github.getOctokit(token);
        await octokit.rest.pulls.update({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            pull_number: prNumber,
            base: branch,
        });

        core.info(`Changed base branch to ${branch}`);
    }

    updateDescription = async (token: string, description: string) => {
        const prNumber = github.context.payload.pull_request?.number;

        if (!prNumber) {
            throw new Error('PR number not found.');
        }

        const octokit = github.getOctokit(token);
        await octokit.rest.pulls.update({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            pull_number: prNumber,
            body: description,
        });

        core.info(`Updated PR description with: ${description}`);
    }

    addComment = async (token: string, comment: string) => {
        const prNumber = github.context.payload.pull_request?.number;

        if (!prNumber) {
            throw new Error('PR number not found.');
        }

        const octokit = github.getOctokit(token);
        await octokit.rest.issues.createComment({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            issue_number: prNumber,
            body: comment,
        });

        core.info(`Comment added to PR ${prNumber}.`);
    }

    getLabels = async (token: string): Promise<string[]> => {
        const prNumber = github.context.payload.pull_request?.number;
        if (!prNumber) {
            core.error(`PR number not found`);
            return [];
        }
        const { owner, repo } = github.context.repo;
        const octokit = github.getOctokit(token);
        const {data: labels} = await octokit.rest.issues.listLabelsOnIssue({
            owner: owner,
            repo: repo,
            issue_number: prNumber,
        });
        return labels.map(label => label.name);
    }
}