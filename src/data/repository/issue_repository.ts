import * as core from "@actions/core";
import * as github from "@actions/github";
import { Labels } from "../model/labels";
import { Milestone } from "../model/milestone";
import { logDebugInfo, logError } from "../utils/logger";

export class IssueRepository {

    private readonly issueTypeTask = 'task'
    private readonly issueTypeBug = 'bug'
    private readonly issueTypeFeature = 'feature'

    updateTitleIssueFormat = async (
        owner: string,
        repository: string,
        version: string,
        issueTitle: string,
        issueNumber: number,
        branchManagementAlways: boolean,
        branchManagementEmoji: string,
        labels: Labels,
        token: string,
    ): Promise<string | undefined> => {
        try {
            const octokit = github.getOctokit(token);

            let emoji = '🤖';

            const branched = branchManagementAlways || labels.containsBranchedLabel

            if (labels.isHotfix && branched) {
                emoji = `🔥${branchManagementEmoji}`;
            } else if (labels.isRelease && branched) {
                emoji = `🚀${branchManagementEmoji}`;
            } else if ((labels.isBugfix || labels.isBug) && branched) {
                emoji = `🐛${branchManagementEmoji}`;
            } else if ((labels.isFeature || labels.isEnhancement) && branched) {
                emoji = `✨${branchManagementEmoji}`;
            } else if ((labels.isDocs || labels.isDocumentation) && branched) {
                emoji = `📝${branchManagementEmoji}`;
            } else if ((labels.isChore || labels.isMaintenance) && branched) {
                emoji = `🔧${branchManagementEmoji}`;
            } else if (labels.isHotfix) {
                emoji = '🔥';
            } else if (labels.isRelease) {
                emoji = '🚀';
            } else if ((labels.isDocs || labels.isDocumentation)) {
                emoji = '📝';
            } else if (labels.isChore || labels.isMaintenance) {
                emoji = '🔧';
            } else if (labels.isBugfix || labels.isBug) {
                emoji = '🐛';
            } else if (labels.isFeature || labels.isEnhancement) {
                emoji = '✨';
            } else if (labels.isHelp) {
                emoji = '🆘';
            } else if (labels.isQuestion) {
                emoji = '❓';
            }

            let sanitizedTitle = issueTitle
                .replace(/\b\d+(\.\d+){2,}\b/g, '')
                .replace(/[^\p{L}\p{N}\p{P}\p{Z}^$\n]/gu, '')
                .replace(/\u200D/g, '')
                .replace(/[^\S\r\n]+/g, ' ')
                .replace(/[^a-zA-Z0-9 .]/g, '')
                .replace(/^-+|-+$/g, '')
                .replace(/- -/g, '-').trim()
                .replace(/-+/g, '-')
                .trim();

            let formattedTitle = `${emoji} - ${sanitizedTitle}`;
            if (version.length > 0) {
                formattedTitle = `${emoji} - ${version} - ${sanitizedTitle}`;
            }

            if (formattedTitle !== issueTitle) {
                await octokit.rest.issues.update({
                    owner: owner,
                    repo: repository,
                    issue_number: issueNumber,
                    title: formattedTitle,
                });

                logDebugInfo(`Issue title updated to: ${formattedTitle}`);
                return formattedTitle;
            }

            return undefined;
        } catch (error) {
            core.setFailed(`Failed to check or update issue title: ${error}`);
            return undefined;
        }
    };

    updateTitlePullRequestFormat = async (
        owner: string,
        repository: string,
        pullRequestTitle: string,
        issueTitle: string,
        issueNumber: number,
        pullRequestNumber: number,
        branchManagementAlways: boolean,
        branchManagementEmoji: string,
        labels: Labels,
        token: string,
    ): Promise<string | undefined> => {
        try {
            const octokit = github.getOctokit(token);

            let emoji = '🤖';

            const branched = branchManagementAlways || labels.containsBranchedLabel

            if (labels.isHotfix && branched) {
                emoji = `🔥${branchManagementEmoji}`;
            } else if (labels.isRelease && branched) {
                emoji = `🚀${branchManagementEmoji}`;
            } else if ((labels.isBugfix || labels.isBug) && branched) {
                emoji = `🐛${branchManagementEmoji}`;
            } else if ((labels.isFeature || labels.isEnhancement) && branched) {
                emoji = `✨${branchManagementEmoji}`;
            } else if ((labels.isDocs || labels.isDocumentation) && branched) {
                emoji = `📝${branchManagementEmoji}`;
            } else if ((labels.isChore || labels.isMaintenance) && branched) {
                emoji = `🔧${branchManagementEmoji}`;
            } else if (labels.isHotfix) {
                emoji = '🔥';
            } else if (labels.isRelease) {
                emoji = '🚀';
            } else if (labels.isBugfix || labels.isBug) {
                emoji = '🐛';
            } else if (labels.isFeature || labels.isEnhancement) {
                emoji = '✨';
            } else if (labels.isDocs || labels.isDocumentation) {
                emoji = '📝';
            } else if (labels.isChore || labels.isMaintenance) {
                emoji = '🔧';
            } else if (labels.isHelp) {
                emoji = '🆘';
            } else if (labels.isQuestion) {
                emoji = '❓';
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

            const formattedTitle = `[#${issueNumber}] ${emoji} - ${sanitizedTitle}`;

            if (formattedTitle !== pullRequestTitle) {
                await octokit.rest.issues.update({
                    owner: owner,
                    repo: repository,
                    issue_number: pullRequestNumber,
                    title: formattedTitle,
                });

                logDebugInfo(`Issue title updated to: ${formattedTitle}`);
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

                logDebugInfo(`Issue title updated to: ${sanitizedTitle}`);
                return sanitizedTitle;
            }

            return undefined;
        } catch (error) {
            core.setFailed(`Failed to check or update issue title: ${error}`);
            return undefined;
        }
    };


    updateDescription = async (
        owner: string,
        repo: string,
        issueNumber: number,
        description: string,
        token: string
    ) => {
        const octokit = github.getOctokit(token);
        try {
            await octokit.rest.issues.update({
                owner,
                repo,
                issue_number: issueNumber,
                body: description,
            });
        } catch (error) {
            logError(`Error updating issue description: ${error}`);
            throw error;
        }
    }

    getDescription = async (
        owner: string,
        repo: string,
        issueNumber: number,
        token: string
    ): Promise<string | undefined> => {
        if (issueNumber === -1) {
            return undefined;
        }
        const octokit = github.getOctokit(token);
        try {
            const {data: issue} = await octokit.rest.issues.get({
                owner,
                repo,
                issue_number: issueNumber,
            });
            return issue.body ?? '';
        } catch (error) {
            logError(`Error reading pull request configuration: ${error}`);
            return undefined
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
        logDebugInfo(`Fetched issue ID: ${issueId}`);

        return issueId;
    }

    getMilestone = async (
        owner: string,
        repository: string,
        issueNumber: number,
        token: string,
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

    getTitle = async (
        owner: string,
        repository: string,
        issueNumber: number,
        token: string,
    ): Promise<string | undefined> => {
        const octokit = github.getOctokit(token);

        try {
            const {data: issue} = await octokit.rest.issues.get({
                owner: owner,
                repo: repository,
                issue_number: issueNumber,
            });

            return issue.title;
        } catch (error) {
            logError(`Failed to fetch the issue title: ${error}`);
            return undefined;
        }
    };

    getLabels = async (
        owner: string,
        repository: string,
        issueNumber: number,
        token: string,
    ): Promise<string[]> => {
        if (issueNumber === -1) {
            return [];
        }
        const octokit = github.getOctokit(token);
        const {data: labels} = await octokit.rest.issues.listLabelsOnIssue({
            owner: owner,
            repo: repository,
            issue_number: issueNumber,
        });
        return labels.map(label => label.name);
    }

    setLabels = async (
        owner: string,
        repository: string,
        issueNumber: number,
        labels: string[],
        token: string,
    ): Promise<void> => {
        const octokit = github.getOctokit(token);
        await octokit.rest.issues.setLabels({
            owner: owner,
            repo: repository,
            issue_number: issueNumber,
            labels: labels,
        });
    }

    isIssue = async (
        owner: string,
        repository: string,
        issueNumber: number,
        token: string,
    ) => {
        const isPullRequest = await this.isPullRequest(
            owner,
            repository,
            issueNumber,
            token,
        )
        return !isPullRequest;
    }

    isPullRequest = async (
        owner: string,
        repository: string,
        issueNumber: number,
        token: string,
    ) => {
        const octokit = github.getOctokit(token);
        const {data} = await octokit.rest.issues.get({
            owner: owner,
            repo: repository,
            issue_number: issueNumber,
        });

        return !!data.pull_request;
    }


    getHeadBranch = async (
        owner: string,
        repository: string,
        issueNumber: number,
        token: string
    ): Promise<string | undefined> => {
        const isPr = await this.isPullRequest(
            owner,
            repository,
            issueNumber,
            token
        )
        if (!isPr) {
            return undefined
        }
        const octokit = github.getOctokit(token);
        const pullRequest = await octokit.rest.pulls.get({
            owner,
            repo: repository,
            pull_number: issueNumber,
        })

        return pullRequest.data.head.ref
    };

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

        logDebugInfo(`Comment added to Issue ${issueNumber}.`);
    }

    closeIssue = async (
        owner: string,
        repository: string,
        issueNumber: number,
        token: string,
    ) => {
        const octokit = github.getOctokit(token);
        const {data: issue} = await octokit.rest.issues.get({
            owner: owner,
            repo: repository,
            issue_number: issueNumber,
        });

        logDebugInfo(`Issue #${issueNumber} state: ${issue.state}`);

        if (issue.state === 'open') {
            await octokit.rest.issues.update({
                owner: owner,
                repo: repository,
                issue_number: issueNumber,
                state: 'closed',
            });
            logDebugInfo(`Issue #${issueNumber} has been closed.`);
            return true;
        } else {
            logDebugInfo(`Issue #${issueNumber} is already closed.`);
            return false;
        }
    }

    openIssue = async (
        owner: string,
        repository: string,
        issueNumber: number,
        token: string,
    ) => {
        const octokit = github.getOctokit(token);
        const {data: issue} = await octokit.rest.issues.get({
            owner: owner,
            repo: repository,
            issue_number: issueNumber,
        });

        logDebugInfo(`Issue #${issueNumber} state: ${issue.state}`);

        if (issue.state === 'closed') {
            await octokit.rest.issues.update({
                owner: owner,
                repo: repository,
                issue_number: issueNumber,
                state: 'open',
            });
            logDebugInfo(`Issue #${issueNumber} has been re-opened.`);
            return true;
        } else {
            logDebugInfo(`Issue #${issueNumber} is already opened.`);
            return false;
        }
    }

    getCurrentAssignees = async (
        owner: string,
        repository: string,
        issueNumber: number,
        token: string
    ): Promise<string[]> => {
        const octokit = github.getOctokit(token);

        try {
            const {data: issue} = await octokit.rest.issues.get({
                owner,
                repo: repository,
                issue_number: issueNumber,
            });

            const assignees = issue.assignees
            if (assignees === undefined || assignees === null) {
                return [];
            }
            return assignees.map((assignee) => assignee.login);
        } catch (error) {
            logError(`Error getting members of issue: ${error}.`);
            return [];
        }
    };

    assignMembersToIssue = async (
        owner: string,
        repository: string,
        issueNumber: number,
        members: string[],
        token: string
    ): Promise<string[]> => {
        const octokit = github.getOctokit(token);

        try {
            if (members.length === 0) {
                logDebugInfo(`No members provided for assignment. Skipping operation.`);
                return [];
            }

            const {data: updatedIssue} = await octokit.rest.issues.addAssignees({
                owner,
                repo: repository,
                issue_number: issueNumber,
                assignees: members,
            });

            const updatedAssignees = updatedIssue.assignees || [];
            return updatedAssignees.map((assignee) => assignee.login);
        } catch (error) {
            logError(`Error assigning members to issue: ${error}.`);
            return [];
        }
    };

    getIssueDescription = async (
        owner: string,
        repository: string,
        issueNumber: number,
        token: string,
    ): Promise<string> => {
        const octokit = github.getOctokit(token);
        const {data: issue} = await octokit.rest.issues.get({
            owner,
            repo: repository,
            issue_number: issueNumber,
        });
        return issue.body ?? '';
    }

    setIssueType = async (
        owner: string,
        repository: string,
        issueNumber: number,
        labels: Labels,
        token: string,
    ): Promise<void> => {
        try {
            let issueType = this.issueTypeTask
            if (labels.isHotfix) {
                issueType = this.issueTypeTask;
            } else if (labels.isRelease) {
                issueType = this.issueTypeTask;
            } else if ((labels.isDocs || labels.isDocumentation)) {
                issueType = this.issueTypeTask;
            } else if (labels.isChore || labels.isMaintenance) {
                issueType = this.issueTypeTask;
            } else if (labels.isBugfix || labels.isBug) {
                issueType = this.issueTypeBug;
            } else if (labels.isFeature || labels.isEnhancement) {
                issueType = this.issueTypeFeature;
            } else if (labels.isHelp) {
                issueType = this.issueTypeTask;
            } else if (labels.isQuestion) {
                issueType = this.issueTypeTask;
            }
            const issueId = await this.getId(owner, repository, issueNumber, token);
            const octokit = github.getOctokit(token);

            logDebugInfo(`Setting issue type for issue ${issueNumber} to ${issueType}`);

            const { organization } = await octokit.graphql<{ organization: { issueTypes: { nodes: { id: string, name: string }[] } } }>(`
                query ($owner: String!) {
                    organization(login: $owner) {
                        issueTypes(first: 10) {
                            nodes {
                                id
                                name
                            }
                        }
                    }
                }
            `, { owner });

            const issueTypeData = organization.issueTypes.nodes.find(type => 
                type.name.toLowerCase() === issueType.toLowerCase()
            );

            if (!issueTypeData) {
                throw new Error(`Issue type "${issueType}" not found in organization ${owner}`);
            }

            await octokit.graphql(`
                mutation ($issueId: ID!, $issueTypeId: ID!) {
                    updateIssueIssueType(input: {issueId: $issueId, issueTypeId: $issueTypeId}) {
                        issue {
                            id
                            issueType {
                                id
                                name
                            }
                        }
                    }
                }
            `, {
                issueId,
                issueTypeId: issueTypeData.id,
            });

            logDebugInfo(`Successfully updated issue type to ${issueType}`);
        } catch (error) {
            logError(`Failed to update issue type: ${error}`);
            throw error;
        }
    }
}
