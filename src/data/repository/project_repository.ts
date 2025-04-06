import * as github from "@actions/github";
import { logDebugInfo, logError } from "../../utils/logger";
import { ProjectResult } from "../graph/project_result";
import { ProjectDetail } from "../model/project_detail";

export class ProjectRepository {
  
    private readonly priorityLabel = "Priority"  
    private readonly sizeLabel = "Size"
    private readonly statusLabel = "Status"
    
    /**
     * Retrieves detailed information about a GitHub project
     * @param projectId - The project number/ID
     * @param token - GitHub authentication token
     * @returns Promise<ProjectDetail> - The project details
     * @throws {Error} If the project is not found or if there are authentication/network issues
     */
    getProjectDetail = async (projectId: string, token: string): Promise<ProjectDetail> => {
        try {
            // Validate projectId is a valid number
            const projectNumber = parseInt(projectId, 10);
            if (isNaN(projectNumber)) {
                throw new Error(`Invalid project ID: ${projectId}. Must be a valid number.`);
            }

            const octokit = github.getOctokit(token);

            const { data: owner } = await octokit.rest.users.getByUsername({
                username: github.context.repo.owner
            }).catch(error => {
                throw new Error(`Failed to get owner information: ${error.message}`);
            });
            
            const ownerType = owner.type === 'Organization' ? 'orgs' : 'users';
            const projectUrl = `https://github.com/${ownerType}/${github.context.repo.owner}/projects/${projectId}`;
            const ownerQueryField = ownerType === 'orgs' ? 'organization' : 'user';

            const queryProject = `
                query($ownerName: String!, $projectNumber: Int!) {
                    ${ownerQueryField}(login: $ownerName) {
                        projectV2(number: $projectNumber) {
                            id
                            title
                            url
                        }
                    }
                }
            `;

            const projectResult = await octokit.graphql<ProjectResult>(queryProject, {
                ownerName: github.context.repo.owner,
                projectNumber: projectNumber,
            }).catch(error => {
                throw new Error(`Failed to fetch project data: ${error.message}`);
            });

            const projectData = projectResult[ownerQueryField]?.projectV2;

            if (!projectData) {
                throw new Error(`Project not found: ${projectUrl}`);
            }

            logDebugInfo(`Project ID: ${projectData.id}`);
            logDebugInfo(`Project Title: ${projectData.title}`);
            logDebugInfo(`Project URL: ${projectData.url}`);

            return new ProjectDetail({
                id: projectData.id,
                title: projectData.title,
                url: projectData.url,
                type: ownerQueryField,
                owner: github.context.repo.owner,
                number: projectNumber,
            });
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            logError(`Error in getProjectDetail: ${errorMessage}`);
            throw error;
        }
    };

    private getContentId = async (
      project: ProjectDetail,
      owner: string,
      repo: string,
      issueOrPullRequestNumber: number,
      token: string
    ): Promise<string | undefined> => {
      const octokit = github.getOctokit(token);
    
      // Search for the issue or pull request ID in the repository
      const issueOrPrQuery = `
      query($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          issueOrPullRequest: issueOrPullRequest(number: $number) {
            ... on Issue {
              id
            }
            ... on PullRequest {
              id
            }
          }
        }
      }`;
    
      const issueOrPrResult: any = await octokit.graphql(issueOrPrQuery, {
        owner,
        repo,
        number: issueOrPullRequestNumber
      });
    
      if (!issueOrPrResult.repository.issueOrPullRequest) {
        console.error(`Issue or PR #${issueOrPullRequestNumber} not found.`);
        return undefined;
      }
    
      const contentId = issueOrPrResult.repository.issueOrPullRequest.id;
    
      // Search for the item ID in the project with pagination
      let cursor: string | null = null;
      let projectItemId: string | undefined = undefined;
    
      do {
        const projectQuery = `
        query($projectId: ID!, $cursor: String) {
          node(id: $projectId) {
            ... on ProjectV2 {
              items(first: 100, after: $cursor) {
                pageInfo {
                  hasNextPage
                  endCursor
                }
                nodes {
                  id
                  content {
                    ... on Issue {
                      id
                    }
                    ... on PullRequest {
                      id
                    }
                  }
                }
              }
            }
          }
        }`;
    
        const projectResult: any = await octokit.graphql(projectQuery, {
          projectId: project.id,
          cursor
        });
    
        const items = projectResult.node.items.nodes;
        const foundItem = items.find((item: any) => item.content?.id === contentId);
    
        if (foundItem) {
          projectItemId = foundItem.id;
          break;
        }
    
        cursor = projectResult.node.items.pageInfo.hasNextPage
          ? projectResult.node.items.pageInfo.endCursor
          : null;
    
      } while (cursor);
    
      return projectItemId;
    };
    
    isContentLinked = async (
        project: ProjectDetail,
        contentId: string,
        token: string
    ): Promise<boolean> => {
        const octokit = github.getOctokit(token);
        let hasNextPage = true;
        let endCursor: string | null = null;
        let allItems: any[] = [];

        while (hasNextPage) {
            const query = `
    query($projectId: ID!, $after: String) {
      node(id: $projectId) {
        ... on ProjectV2 {
          items(first: 100, after: $after) {
            nodes {
              content {
                ... on PullRequest {
                  id
                }
                ... on Issue {
                  id
                }
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      }
    }
  `;

            logDebugInfo(`Query: ${query}`);
            logDebugInfo(`Project ID: ${project.id}`);
            logDebugInfo(`Content ID: ${contentId}`);
            logDebugInfo(`After cursor: ${endCursor}`);

            const result: any = await octokit.graphql(query, {
                projectId: project.id,
                after: endCursor,
            });

            logDebugInfo(`Result: ${JSON.stringify(result, null, 2)}`);

            const items = result.node.items.nodes;
            allItems = allItems.concat(items);

            hasNextPage = result.node.items.pageInfo.hasNextPage;
            endCursor = result.node.items.pageInfo.endCursor;
        }

        return allItems.some(
            (item: any) => item.content && item.content.id === contentId
        );
    };

    linkContentId = async (project: ProjectDetail, contentId: string, token: string) => {
        const alreadyLinked = await this.isContentLinked(project, contentId, token);
        if (alreadyLinked) {
            logDebugInfo(`Content ${contentId} is already linked to project ${project.id}.`);
            return false;
        }

        const octokit = github.getOctokit(token);

        const linkMutation = `
          mutation($projectId: ID!, $contentId: ID!) {
            addProjectV2ItemById(input: {projectId: $projectId, contentId: $contentId}) {
              item {
                id
              }
            }
          }
        `;
        const linkResult: any = await octokit.graphql(linkMutation, {
            projectId: project.id,
            contentId: contentId,
        });

        logDebugInfo(`Linked ${contentId} with id ${linkResult.addProjectV2ItemById.item.id} to project ${project.id}`);

        return true;
    }

    private setSingleSelectFieldValue = async (
        project: ProjectDetail,
        owner: string,
        repo: string,
        issueOrPullRequestNumber: number,
        fieldName: string,
        fieldValue: string,
        token: string
    ): Promise<boolean> => {
        const contentId = await this.getContentId(project, owner, repo, issueOrPullRequestNumber, token);
        if (!contentId) {
            logError(`Content ID not found for issue or pull request #${issueOrPullRequestNumber}.`);
            return false; 
        }

        logDebugInfo(`Content ID: ${contentId}`);

        const octokit = github.getOctokit(token);

        // Get the field ID and current value
        const fieldQuery = `
        query($projectId: ID!, $after: String) {
          node(id: $projectId) {
            ... on ProjectV2 {
              fields(first: 20) {
                nodes { 
                  ... on ProjectV2SingleSelectField {
                    id
                    name
                    options {
                      id
                      name  
                    }
                  }
                }
              }
              items(first: 100, after: $after) {
                pageInfo {
                  hasNextPage
                  endCursor
                }
                nodes {
                  id
                  fieldValues(first: 20) {
                    nodes {
                      ... on ProjectV2ItemFieldSingleSelectValue {
                        field {
                          ... on ProjectV2SingleSelectField {
                            name
                          }
                        }
                        optionId
                      }
                    }
                  }
                }
              }
            }
          }         
        }`;

        let hasNextPage = true;
        let endCursor: string | null = null;
        let currentItem: any = null;

        // Get the field and option information from the first page
        const initialFieldResult: any = await octokit.graphql(fieldQuery, { 
            projectId: project.id,
            after: null
        });

        const targetField = initialFieldResult.node.fields.nodes.find(
            (f: any) => f.name === fieldName
        );

        logDebugInfo(`Target field: ${JSON.stringify(targetField, null, 2)}`);

        if (!targetField) {
            logError(`Field '${fieldName}' not found or is not a single-select field.`);
            return false;
        }

        const targetOption = targetField.options.find(
            (opt: any) => opt.name === fieldValue
        );

        logDebugInfo(`Target option: ${JSON.stringify(targetOption, null, 2)}`);

        if (!targetOption) {
            logError(`Option '${fieldValue}' not found for field '${fieldName}'.`);
            return false;
        }

        // Now search for the item through all pages
        while (hasNextPage) {
            const fieldResult: any = await octokit.graphql(fieldQuery, { 
                projectId: project.id,
                after: endCursor
            });

            logDebugInfo(`Field result: ${JSON.stringify(fieldResult, null, 2)}`);

            // Check current value in current page
            currentItem = fieldResult.node.items.nodes.find((item: any) => item.id === contentId);
            if (currentItem) {
                logDebugInfo(`Current item: ${JSON.stringify(currentItem, null, 2)}`);
                const currentFieldValue = currentItem.fieldValues.nodes.find(
                    (value: any) => value.field?.name === fieldName
                );
                
                if (currentFieldValue && currentFieldValue.optionId === targetOption.id) {
                    logDebugInfo(`Field '${fieldName}' is already set to '${fieldValue}'. No update needed.`);
                    return false;
                }
                break; // Found the item, no need to continue pagination
            }

            hasNextPage = fieldResult.node.items.pageInfo.hasNextPage;
            endCursor = fieldResult.node.items.pageInfo.endCursor;
        }

        logDebugInfo(`Target field ID: ${targetField.id}`);
        logDebugInfo(`Target option ID: ${targetOption.id}`);

        const mutation = `
        mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
          updateProjectV2ItemFieldValue(  
            input: {
              projectId: $projectId,
              itemId: $itemId,
              fieldId: $fieldId,
              value: { singleSelectOptionId: $optionId }
            }
          ) {
            projectV2Item {
              id
            }
          }
        }`;

        const mutationResult: any = await octokit.graphql(mutation, {
            projectId: project.id,
            itemId: contentId,
            fieldId: targetField.id,
            optionId: targetOption.id
        });

        return !!mutationResult.updateProjectV2ItemFieldValue.projectV2Item;
    };

    setTaskPriority = async (
        project: ProjectDetail,
        owner: string,
        repo: string,
        issueOrPullRequestNumber: number,
        priorityLabel: string,
        token: string
    ): Promise<boolean> => this.setSingleSelectFieldValue(
        project,
        owner,
        repo,
        issueOrPullRequestNumber,
        this.priorityLabel,
        priorityLabel,
        token
    );

    setTaskSize = async (
        project: ProjectDetail,
        owner: string,
        repo: string,
        issueOrPullRequestNumber: number,
        sizeLabel: string,
        token: string
    ): Promise<boolean> => this.setSingleSelectFieldValue(
        project,
        owner,
        repo,
        issueOrPullRequestNumber,
        this.sizeLabel,
        sizeLabel,
        token
    );

    moveIssueToColumn = async (
        project: ProjectDetail,
        owner: string,
        repo: string,
        issueOrPullRequestNumber: number,
        columnName: string,
        token: string
    ): Promise<boolean> => this.setSingleSelectFieldValue(
        project,
        owner,
        repo,
        issueOrPullRequestNumber,
        this.statusLabel,
        columnName,
        token
    );

    getRandomMembers = async (
        organization: string,
        membersToAdd: number,
        currentMembers: string[],
        token: string
    ): Promise<string[]> => {
        if (membersToAdd === 0) {
            return [];
        }

        const octokit = github.getOctokit(token);

        try {
            const {data: teams} = await octokit.rest.teams.list({
                org: organization,
            });

            if (teams.length === 0) {
                logDebugInfo(`${organization} doesn't have any team.`);
                return [];
            }

            const membersSet = new Set<string>();

            for (const team of teams) {
                const {data: members} = await octokit.rest.teams.listMembersInOrg({
                    org: organization,
                    team_slug: team.slug,
                });
                members.forEach((member) => membersSet.add(member.login));
            }

            const allMembers = Array.from(membersSet);
            const availableMembers = allMembers.filter((member) => !currentMembers.includes(member));

            if (availableMembers.length === 0) {
                logDebugInfo(`No available members to assign for organization ${organization}.`);
                return [];
            }

            if (membersToAdd >= availableMembers.length) {
                logDebugInfo(
                    `Requested size (${membersToAdd}) exceeds available members (${availableMembers.length}). Returning all available members.`
                );
                return availableMembers;
            }

            const shuffled = availableMembers.sort(() => Math.random() - 0.5);
            return shuffled.slice(0, membersToAdd);
        } catch (error) {
            logError(`Error getting random members: ${error}.`);
        }
        return [];
    };

    getAllMembers = async (
        organization: string,
        token: string
    ): Promise<string[]> => {
        const octokit = github.getOctokit(token);

        try {
            const {data: teams} = await octokit.rest.teams.list({
                org: organization,
            });

            if (teams.length === 0) {
                logDebugInfo(`${organization} doesn't have any team.`);
                return [];
            }

            const membersSet = new Set<string>();

            for (const team of teams) {
                const {data: members} = await octokit.rest.teams.listMembersInOrg({
                    org: organization,
                    team_slug: team.slug,
                });
                members.forEach((member) => membersSet.add(member.login));
            }

            return Array.from(membersSet);
        } catch (error) {
            logError(`Error getting all members: ${error}.`);
        }
        return [];
    };

    getUserFromToken = async (token: string): Promise<string> => {
        const octokit = github.getOctokit(token);
        const {data: user} = await octokit.rest.users.getAuthenticated();
        return user.login;
    }

}
