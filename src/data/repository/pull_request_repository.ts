import * as github from "@actions/github";
import * as core from "@actions/core";

export class PullRequestRepository {

    isLinked = async (pullRequestUrl: string) => {
        core.info(`Fetching PR URL: ${pullRequestUrl}`);
        const htmlContent = await fetch(pullRequestUrl).then(res => res.text());
        const isLinked = !htmlContent.includes('has_github_issues=false');
        core.exportVariable('is_linked', isLinked.toString());

        core.info(`Is PR linked to an issue? ${isLinked}`);
        return isLinked;
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

        core.info(`Changed base branch to ${branch}`);
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

        core.info(`Updated PR #${pullRequestNumber} description with: ${description}`);
    }

    addComment = async (
        owner: string,
        repository: string,
        pullRequestNumber: number,
        comment: string,
        token: string,
    ) => {
        const octokit = github.getOctokit(token);
        await octokit.rest.issues.createComment({
            owner: owner,
            repo: repository,
            issue_number: pullRequestNumber,
            body: comment,
        });

        core.info(`Comment added to PR #${pullRequestNumber}: ${comment}`);
    }

    getLabels = async (
        owner: string,
        repository: string,
        pullRequestNumber: number,
        token: string,
    ): Promise<string[]> => {
        const octokit = github.getOctokit(token);
        const {data: labels} = await octokit.rest.issues.listLabelsOnIssue({
            owner: owner,
            repo: repository,
            issue_number: pullRequestNumber,
        });
        return labels.map(label => label.name);
    }
}