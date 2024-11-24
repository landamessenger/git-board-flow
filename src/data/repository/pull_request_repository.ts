import * as github from "@actions/github";
import * as core from "@actions/core";
import {Config} from "../model/config";

export class PullRequestRepository {

    private startConfigPattern = '<!-- GIT-BOARD-CONFIG-START'
    private endConfigPattern = 'GIT-BOARD-CONFIG-END -->'

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

    updateConfig = async (
        owner: string,
        repo: string,
        issueNumber: number,
        config: Config,
        token: string
    ) => {
        const octokit = github.getOctokit(token);

        try {
            const {data: issue} = await octokit.rest.issues.get({
                owner,
                repo,
                issue_number: issueNumber,
            });

            const currentDescription = issue.body || '';

            const configBlock = `${this.startConfigPattern} 
${JSON.stringify(config, null, 4)}
${this.endConfigPattern}`;

            const storedConfig = currentDescription.split(this.startConfigPattern)[1].split(this.endConfigPattern)[0]
            const oldContent = `${this.startConfigPattern}${storedConfig}${this.endConfigPattern}`
            const updatedDescription = currentDescription.replace(oldContent, '')

            const finalDescription = `${updatedDescription}\n\n${configBlock}`;

            await octokit.rest.issues.update({
                owner,
                repo,
                issue_number: issueNumber,
                body: finalDescription,
            });

            console.log(`Issue #${issueNumber} updated with branch configuration.`);
        } catch (error) {
            console.error(`Error updating issue description: ${error}`);
            throw error;
        }
    }

    readConfig = async (
        owner: string,
        repo: string,
        issueNumber: number,
        token: string
    ): Promise<Config | undefined> => {
        const octokit = github.getOctokit(token);

        try {
            const {data: issue} = await octokit.rest.issues.get({
                owner,
                repo,
                issue_number: issueNumber,
            });

            const currentDescription = issue.body || '';

            if (currentDescription.indexOf(this.startConfigPattern) === -1) {
                return undefined;
            }

            const config = currentDescription.split(this.startConfigPattern)[1].split(this.endConfigPattern)[0]

            const branchConfig = JSON.parse(config);

            return new Config(branchConfig);
        } catch (error) {
            core.error(`Error reading issue configuration: ${error}`);
            throw error;
        }
    }
}