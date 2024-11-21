import * as github from "@actions/github";
import * as core from "@actions/core";

export class ProjectRepository {
    getProjectId = async (projectUrl: string, token: string) => {
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
            }
          }
        }
        `;
        const projectResult = await octokit.graphql<ProjectResult>(queryProject, {
            ownerName,
            projectNumber: parseInt(projectNumber, 10),
        });

        const projectId = projectResult[ownerQueryField].projectV2.id;

        core.info(`Project ID: ${projectId}`);

        return projectId
    }

    linkPullRequest = async (projectId: string, token: string) => {
        const octokit = github.getOctokit(token);
        const contentId = github.context.payload.pull_request?.node_id;

        const mutation = `
        mutation($input: AddProjectV2ItemByIdInput!) {
          addProjectV2ItemById(input: $input) {
            item {
              id
            }
          }
        }
        `;

        const response = await octokit.graphql<AddProjectItemResponse>(mutation, {
            input: {projectId, contentId},
        });

        core.info(`PR added to project with item ID: ${response.addProjectV2ItemById.item.id}`);
    }
}