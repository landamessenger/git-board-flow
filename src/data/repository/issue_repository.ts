import * as core from "@actions/core";
import * as github from "@actions/github";
import { logDebugInfo, logError } from "../../utils/logger";
import { Labels } from "../model/labels";
import { Milestone } from "../model/milestone";
import { IssueTypes } from "../model/issue_types";

export class IssueRepository {

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
            logError(`Error reading issue #${issueNumber} description: ${error}`);
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

    updateComment = async (
        owner: string,
        repository: string,
        issueNumber: number,
        commentId: number,
        comment: string,
        token: string,
    ) => {
        const octokit = github.getOctokit(token);
        await octokit.rest.issues.updateComment({
            owner: owner,
            repo: repository,
            comment_id: commentId,
            body: comment,
        });

        logDebugInfo(`Comment ${commentId} updated in Issue ${issueNumber}.`);
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
        issueTypes: IssueTypes,
        token: string,
    ): Promise<void> => {
        try {
            let issueType = issueTypes.task
            let issueTypeDescription = issueTypes.taskDescription
            let issueTypeColor = issueTypes.taskColor
            if (labels.isHotfix) {
                issueType = issueTypes.hotfix;
                issueTypeDescription = issueTypes.hotfixDescription;
                issueTypeColor = issueTypes.hotfixColor;
            } else if (labels.isRelease) {
                issueType = issueTypes.release;
                issueTypeDescription = issueTypes.releaseDescription;
                issueTypeColor = issueTypes.releaseColor;
            } else if ((labels.isDocs || labels.isDocumentation)) {
                issueType = issueTypes.documentation;
                issueTypeDescription = issueTypes.documentationDescription;
                issueTypeColor = issueTypes.documentationColor;
            } else if (labels.isChore || labels.isMaintenance) {
                issueType = issueTypes.maintenance;
                issueTypeDescription = issueTypes.maintenanceDescription;
                issueTypeColor = issueTypes.maintenanceColor;
            } else if (labels.isBugfix || labels.isBug) {
                issueType = issueTypes.bug;
                issueTypeDescription = issueTypes.bugDescription;
                issueTypeColor = issueTypes.bugColor;
            } else if (labels.isFeature || labels.isEnhancement) {
                issueType = issueTypes.feature;
                issueTypeDescription = issueTypes.featureDescription;
                issueTypeColor = issueTypes.featureColor;
            } else if (labels.isHelp) {
                issueType = issueTypes.help;
                issueTypeDescription = issueTypes.helpDescription;
                issueTypeColor = issueTypes.helpColor;
            } else if (labels.isQuestion) {
                issueType = issueTypes.question;
                issueTypeDescription = issueTypes.questionDescription;
                issueTypeColor = issueTypes.questionColor;
            }

            const octokit = github.getOctokit(token);
            logDebugInfo(`Setting issue type for issue ${issueNumber} to ${issueType}`);
            logDebugInfo(`Creating new issue type "${issueType}" for organization ${owner}...`);
            logDebugInfo(`Issue Type: ${issueType}`);
            logDebugInfo(`Issue Type Description: ${issueTypeDescription}`);
            logDebugInfo(`Issue Type Color: ${issueTypeColor}`);

            try {
                // Try to update the issue with the issue type using GraphQL
                const issueId = await this.getId(owner, repository, issueNumber, token);
                
                // First, try to find existing issue types in the organization
                const { organization } = await octokit.graphql<{ 
                    organization: { 
                        id: string, 
                        issueTypes: { 
                            nodes: { id: string, name: string }[] 
                        } 
                    } 
                }>(`
                    query ($owner: String!) {
                        organization(login: $owner) {
                            id
                            issueTypes(first: 20) {
                                nodes {
                                    id
                                    name
                                }
                            }
                        }
                    }
                `, { owner });

                logDebugInfo(`Organization ID: ${organization.id}`);
                logDebugInfo(`Organization issue types: ${JSON.stringify(organization.issueTypes.nodes)}`);

                // Check if the issue type already exists
                const existingType = organization.issueTypes.nodes.find((type: { name: string }) => 
                    type.name.toLowerCase() === issueType.toLowerCase()
                );

                let issueTypeId;
                if (existingType) {
                    issueTypeId = existingType.id;
                    logDebugInfo(`Found existing issue type "${issueType}" with ID: ${issueTypeId}`);
                } else {
                    // Try to create the issue type using GraphQL
                    
                    try {
                        logDebugInfo(`Creating new issue type "${issueType}" for organization ${owner}...`);
                        
                        const createResult = await octokit.graphql<{ 
                            createIssueType: { 
                                issueType: { id: string } 
                            } 
                        }>(`
                            mutation ($ownerId: ID!, $name: String!, $description: String!, $color: String!, $isEnabled: Boolean!) {
                                createIssueType(input: {
                                    ownerId: $ownerId, 
                                    name: $name,
                                    description: $description,
                                    color: $color,
                                    isEnabled: $isEnabled
                                }) {
                                    issueType {
                                        id
                                    }
                                }
                            }
                        `, { 
                            ownerId: organization.id, 
                            name: issueType,
                            description: issueTypeDescription,
                            color: issueTypeColor.toUpperCase(),
                            isEnabled: true,
                        });
                        
                        issueTypeId = createResult.createIssueType.issueType.id;
                        logDebugInfo(`Created new issue type "${issueType}" with ID: ${issueTypeId}`);
                    } catch (createError) {
                        logError(`Failed to create issue type "${issueType}": ${createError}`);
                        // If creation fails, we'll fall back to using labels
                        logDebugInfo(`Falling back to using labels for issue type classification`);
                        return;
                    }
                }

                // Update the issue with the issue type using GraphQL
                await octokit.graphql(`
                    mutation ($issueId: ID!, $issueTypeId: ID!) {
                        updateIssueIssueType(input: {
                            issueId: $issueId, 
                            issueTypeId: $issueTypeId
                        }) {
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
                    issueTypeId,
                });

                logDebugInfo(`Successfully updated issue type to ${issueType}`);
            } catch (updateError) {
                logError(`Failed to update issue type via GraphQL: ${updateError}`);
                
                // Fallback: If issue type update fails, we can still ensure the appropriate labels are set
                logDebugInfo(`Falling back to label-based classification for issue ${issueNumber}`);
                
                // The labels should already be set by the calling code, so we just log this
                logDebugInfo(`Issue type classification will be handled through labels: ${issueType}`);
                throw updateError;
            }
        } catch (error) {
            logError(`Failed to update issue type: ${error}`);
            // Don't throw the error to prevent breaking the main flow
            // The issue will still be processed with labels
            logDebugInfo(`Continuing with issue processing despite issue type update failure`);
            throw error;
        }
    }
}
