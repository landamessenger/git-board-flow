import * as github from "@actions/github";
import * as core from "@actions/core";
import {Milestone} from "../model/milestone";
import {Config} from "../model/config";

export class IssueRepository {
    private startConfigPattern = '<!-- GIT-BOARD-CONFIG-START'
    private endConfigPattern = 'GIT-BOARD-CONFIG-END -->'

    updateTitle = async (
        owner: string,
        repository: string,
        issueTitle: string,
        issueNumber: number,
        branchType: string,
        isHotfix: boolean,
        isQuestion: boolean,
        isHelp: boolean,
        featureLabel: string,
        bugfixLabel: string,
        releaseLabel: string,
        token: string,
    ): Promise<string | undefined> => {
        try {
            const octokit = github.getOctokit(token);

            let emoji = '🤖';

            if (isHelp) {
                emoji = '🆘';
            } else if (isQuestion) {
                emoji = '❓';
            } else if (isHotfix) {
                emoji = '🔥';
            } else if (branchType === bugfixLabel) {
                emoji = '🐛';
            } else if (branchType === featureLabel) {
                emoji = '🛠️';
            } else if (branchType === releaseLabel) {
                emoji = '🚀';
            }

            let sanitizedTitle = issueTitle
                .replace(/[^\p{L}\p{N}\p{P}\p{Z}^$\n]/gu, '')
                .replace(/\u200D/g, '')
                .replace(/[^\S\r\n]+/g, ' ')
                .replace(/[^a-zA-Z0-9 ]/g, '')
                .replace(/^-+|-+$/g, '')
                .replace(/- -/g, '-').trim()
                .replace(/-+/g, '-')
                .trim();

            const formattedTitle = `${emoji} - ${sanitizedTitle}`;

            if (formattedTitle !== issueTitle) {
                await octokit.rest.issues.update({
                    owner: owner,
                    repo: repository,
                    issue_number: issueNumber,
                    title: formattedTitle,
                });

                core.info(`Issue title updated to: ${formattedTitle}`);
                return formattedTitle;
            }

            return undefined;
        } catch (error) {
            core.setFailed(`Failed to check or update issue title: ${error}`);
            return undefined;
        }
    };

    cleanTitle = async (
        owner: string,
        repository: string,
        issueTitle: string,
        issueNumber: number,
        token: string,
    ): Promise<string | undefined> => {
        try {
            const octokit = github.getOctokit(token);

            let sanitizedTitle = issueTitle
                .replace(/[^\p{L}\p{N}\p{P}\p{Z}^$\n]/gu, '')
                .replace(/\u200D/g, '')
                .replace(/[^\S\r\n]+/g, ' ')
                .replace(/[^a-zA-Z0-9 ]/g, '')
                .replace(/^-+|-+$/g, '')
                .replace(/- -/g, '-').trim()
                .replace(/-+/g, '-')
                .trim();

            if (sanitizedTitle !== issueTitle) {
                await octokit.rest.issues.update({
                    owner: owner,
                    repo: repository,
                    issue_number: issueNumber,
                    title: sanitizedTitle,
                });

                core.info(`Issue title updated to: ${sanitizedTitle}`);
                return sanitizedTitle;
            }

            return undefined;
        } catch (error) {
            core.setFailed(`Failed to check or update issue title: ${error}`);
            return undefined;
        }
    };


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

            if (currentDescription.indexOf(this.startConfigPattern) === -1
                || currentDescription.indexOf(this.endConfigPattern) === -1) {
                console.log(`Issue #${issueNumber} has no branch configuration.`);
                return;
            }

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

    fetchIssueProjects = async (
        owner: string,
        repo: string,
        issueNumber: number,
        token: string
    ): Promise<ProjectItem[]> => {
        try {
            const octokit = github.getOctokit(token);

            const query = `
            query($owner: String!, $repo: String!, $issueNumber: Int!) {
              repository(owner: $owner, name: $repo) {
                issue(number: $issueNumber) {
                  projectItems(first: 10) {
                    nodes {
                      id
                      project {
                        id
                        title
                        url
                      }
                    }
                  }
                }
              }
            }
        `;

            const response: IssueProjectsResponse = await octokit.graphql(query, {
                owner,
                repo,
                issueNumber,
            });

            return response.repository.issue.projectItems.nodes.map((item) => ({
                id: item.id,
                project: {
                    id: item.project.id,
                    title: item.project.title,
                    url: item.project.url,
                },
            }));
        } catch (error) {
            core.setFailed(`Error fetching issue projects: ${error}`);
            throw error;
        }
    };

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