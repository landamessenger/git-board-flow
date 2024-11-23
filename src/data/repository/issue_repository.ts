import * as github from "@actions/github";
import * as core from "@actions/core";

export class IssueRepository {
    updateTitle = async (token: string): Promise<void> => {
        try {
            const octokit = github.getOctokit(token);
            const issueNumber = github.context.payload.issue?.number;
            const issueTitle = github.context.payload.issue?.title as string | undefined;

            if (!issueTitle || !issueNumber) {
                return
            }

            const titlePattern = new RegExp(`^\\d+\\s*-\\s*`);

            if (!titlePattern.test(issueTitle)) {
                const formattedTitle = `${issueNumber} - ${issueTitle}`;

                await octokit.rest.issues.update({
                    owner: github.context.repo.owner,
                    repo: github.context.repo.repo,
                    issue_number: issueNumber,
                    title: formattedTitle
                });

                core.info(`Issue title updated to: ${formattedTitle}`);
            }
        } catch (error) {
            core.setFailed(`Failed to check or update issue title: ${error}`);
        }
    }

    getId = async (token: string): Promise<string> => {
        const octokit = github.getOctokit(token);
        const issueNumber = github.context.payload.issue?.number;

        if (!issueNumber) {
            throw new Error("No issue number found in the context payload.");
        }

        // Fetch the Issue ID
        const issueQuery = `
          query($repo: String!, $owner: String!, $issueNumber: Int!) {
            repository(name: $repo, owner: $owner) {
              issue(number: $issueNumber) {
                id
              }
            }
          }
        `;
        const issueResult: any = await octokit.graphql(issueQuery, {
            repo: github.context.repo.repo,
            owner: github.context.repo.owner,
            issueNumber,
        });

        const issueId = issueResult.repository.issue.id;
        core.info(`Fetched issue ID: ${issueId}`);

        return issueId;
    }

    getIssueLabels = async (token: string): Promise<string[]> => {
        const issueNumber = github.context.payload.issue?.number;
        if (!issueNumber) {
            core.error(`Issue number not found`);
            return [];
        }
        const octokit = github.getOctokit(token);
        const {data: labels} = await octokit.rest.issues.listLabelsOnIssue({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            issue_number: issueNumber,
        });
        return labels.map(label => label.name);
    }

    _branchesForIssue = (
        labels: string[],
        bugfixLabel: string,
        hotfixLabel: string,
    ): string => {
        if (labels.includes(bugfixLabel)) return 'bugfix';
        if (labels.includes(hotfixLabel)) return 'bugfix';
        return 'feature';
    }

    isHotfix = async (token: string, hotfixLabel: string): Promise<boolean> => {
        const labels = await this.getIssueLabels(token)
        return labels.includes(hotfixLabel)
    }

    branchesForIssue = async (
        token: string,
        bugfixLabel: string,
        hotfixLabel: string,
    ): Promise<string> => {
        const labels = await this.getIssueLabels(token)
        return this._branchesForIssue(labels, bugfixLabel, hotfixLabel)
    }

    addComment = async (token: string, comment: string) => {
        const issueNumber = github.context.payload.issue?.number;

        if (!issueNumber) {
            throw new Error('Issue number not found.');
        }

        const octokit = github.getOctokit(token);
        await octokit.rest.issues.createComment({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            issue_number: issueNumber,
            body: comment,
        });

        core.info(`Comment added to Issue ${issueNumber}.`);
    }
}