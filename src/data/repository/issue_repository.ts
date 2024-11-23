import * as github from "@actions/github";
import * as core from "@actions/core";
import {Milestone} from "../model/milestone";

export class IssueRepository {
    updateTitle = async (
        owner: string,
        repository: string,
        issueTitle: string,
        issueNumber: number,
        branchType: string,
        isHotfix: boolean,
        isQuestion: boolean,
        isHelp: boolean,
        token: string,
    ): Promise<void> => {
        try {
            const octokit = github.getOctokit(token);

            let emoji = '🤖';

            const emojiPattern = /^[\p{Emoji_Presentation}\p{Emoji}\u200D]+(\s*-\s*)?/u;

            const sanitizedTitle = issueTitle.replace(emojiPattern, '').trim();

            if (isHelp) {
                emoji = '🆘';
            } else if (isQuestion) {
                emoji = '❓';
            } else if (isHotfix) {
                emoji = '🔥';
            } else if (branchType === 'bugfix') {
                emoji = '🐛';
            } else if (branchType === 'feature') {
                emoji = '🛠️';
            }

            const formattedTitle = `${emoji} - ${sanitizedTitle}`;

            await octokit.rest.issues.update({
                owner: owner,
                repo: repository,
                issue_number: issueNumber,
                title: formattedTitle,
            });

            core.info(`Issue title updated to: ${formattedTitle}`);
        } catch (error) {
            core.setFailed(`Failed to check or update issue title: ${error}`);
        }
    }

    getId = async (
        owner: string,
        repository: string,
        issueNumber: number,
        token: string,
    ): Promise<string> => {
        const octokit = github.getOctokit(token);

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
            owner: owner,
            repo: repository,
            issueNumber,
        });

        const issueId = issueResult.repository.issue.id;
        core.info(`Fetched issue ID: ${issueId}`);

        return issueId;
    }

    getMilestone = async (
        owner: string,
        repository: string,
        token: string,
        issueNumber: number,
    ): Promise<Milestone | undefined> => {
        const octokit = github.getOctokit(token);

        const {data: issue} = await octokit.rest.issues.get({
            owner: owner,
            repo: repository,
            issue_number: issueNumber,
        });

        if (issue.milestone) {
            return new Milestone(
                issue.milestone.id,
                issue.milestone.title,
                issue.milestone.description ?? '',
            )
        } else {
            return undefined
        }
    }

    getLabels = async (
        owner: string,
        repository: string,
        issueNumber: number,
        token: string,
    ): Promise<string[]> => {
        const octokit = github.getOctokit(token);
        const {data: labels} = await octokit.rest.issues.listLabelsOnIssue({
            owner: owner,
            repo: repository,
            issue_number: issueNumber,
        });
        return labels.map(label => label.name);
    }

    isHotfix = async (
        owner: string,
        repository: string,
        issueNumber: number,
        hotfixLabel: string,
        token: string,
    ): Promise<boolean> => {
        const labels = await this.getLabels(owner, repository, issueNumber, token)
        return labels.includes(hotfixLabel)
    }

    addComment = async (
        owner: string,
        repository: string,
        issueNumber: number,
        comment: string,
        token: string,
    ) => {
        const octokit = github.getOctokit(token);
        await octokit.rest.issues.createComment({
            owner: owner,
            repo: repository,
            issue_number: issueNumber,
            body: comment,
        });

        core.info(`Comment added to Issue ${issueNumber}.`);
    }
}