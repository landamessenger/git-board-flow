import * as github from "@actions/github";
import { ProjectDetail } from "../model/project_detail";
import { logDebugInfo, logError } from "../utils/logger";

export class ProjectRepository {
    getProjectDetail = async (projectUrl: string, token: string) => {
        const octokit = github.getOctokit(token);
        const projectMatch = projectUrl.match(/\/(?<ownerType>orgs|users)\/(?<ownerName>[^/]+)\/projects\/(?<projectNumber>\d+)/);

        if (!projectMatch || !projectMatch.groups) {
            throw new Error(`Invalid project URL: ${projectUrl}`);
        }

        const {ownerType, ownerName, projectNumber} = projectMatch.groups;
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
            ownerName,
            projectNumber: parseInt(projectNumber, 10),
        });

        const projectData = projectResult[ownerQueryField].projectV2;

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
            owner: ownerName,
            number: parseInt(projectNumber, 10),
        });
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

        logDebugInfo(`Linked ${contentId} to organization project: ${linkResult.addProjectV2ItemById.item.id}`);

        return true;
    }

    setTaskSize = async (
        project: ProjectDetail,
        owner: string,
        repo: string,
        issueOrPullRequestNumber: number,
        sizeLabel: string,
        token: string
    ): Promise<boolean> => {
        const contentId = await this.getContentId(project, owner, repo, issueOrPullRequestNumber, token);
        if (!contentId) {
            logError(`Content ID not found for issue or pull request #${issueOrPullRequestNumber}.`);
            return false;
        }

        const octokit = github.getOctokit(token);
    
        // Get the field ID of the "Size" field in the project
        const fieldQuery = `
        query($projectId: ID!) {
          node(id: $projectId) {
            ... on ProjectV2 {
              fields(first: 20) {
                nodes {
                  id
                  name
                  ... on ProjectV2SingleSelectField {
                    options {
                      id
                      name
                    }
                  }
                }
              }
            }
          }
        }`;
    
        const fieldResult: any = await octokit.graphql(fieldQuery, { projectId: project.id });
    
        const sizeField = fieldResult.node.fields.nodes.find((f: any) => f.name === "Size");
        if (!sizeField) {
            console.error(`Field 'Size' not found in the project.`);
            return false;
        }
    
        const sizeOption = sizeField.options.find((opt: any) => opt.name === sizeLabel);
        if (!sizeOption) {
            console.error(`Size option '${sizeLabel}' not found.`);
            return false;
        }
    
        // Assign the size to the issue
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
            fieldId: sizeField.id,
            optionId: sizeOption.id
        });
    
        return !!mutationResult.updateProjectV2ItemFieldValue.projectV2Item;
    }

    moveIssueToColumn = async (
      project: ProjectDetail,
      owner: string,
      repo: string,
      issueOrPullRequestNumber: number,
      columnName: string,
      token: string
  ): Promise<boolean> => {
      const contentId = await this.getContentId(project, owner, repo, issueOrPullRequestNumber, token);
      if (!contentId) {
          logError(`Content ID not found for issue or pull request #${issueOrPullRequestNumber}.`);
          return false;
      }
  
      logDebugInfo(`Project ID: ${project.id}`);
      logDebugInfo(`Issue or Pull Request Number: ${issueOrPullRequestNumber}`);
      logDebugInfo(`Content ID: ${contentId}`);
      logDebugInfo(`Column Name: ${columnName}`);

      const octokit = github.getOctokit(token);
  
      // Get the field ID of the "Status" field in the project
      const fieldQuery = `
      query($projectId: ID!) {
        node(id: $projectId) {
          ... on ProjectV2 {
            fields(first: 20) {
              nodes {
                id
                name
                ... on ProjectV2SingleSelectField {
                  options {
                    id
                    name
                  }
                }
              }
            }
          }
        }
      }`;
  
      const fieldResult: any = await octokit.graphql(fieldQuery, { projectId: project.id });
  
      if (!fieldResult.node || !fieldResult.node.fields) {
          logError(`Failed to fetch fields for project.`);
          return false;
      }
  
      // Filtrar solo los campos que son del tipo ProjectV2SingleSelectField
      const statusField = fieldResult.node.fields.nodes.find(
          (f: any) => f.name === "Status" && f.options
      );
  
      if (!statusField) {
          logError(`Field 'Status' not found or is not a single-select field.`);
          return false;
      }
  
      const columnOption = statusField.options.find((opt: any) => opt.name === columnName);
      if (!columnOption) {
          logError(`Option '${columnName}' not found.`);
          return false;
      }
  
      // Assign the option status to the issue
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
          fieldId: statusField.id,
          optionId: columnOption.id
      });
  
      return !!mutationResult.updateProjectV2ItemFieldValue.projectV2Item;
    };  

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

}
