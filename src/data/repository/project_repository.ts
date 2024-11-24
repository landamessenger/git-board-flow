import * as github from "@actions/github";
import * as core from "@actions/core";
import {ProjectDetail} from "../model/project_detail";

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

        return new ProjectDetail({
            id: projectId,
            type: ownerQueryField,
            owner: ownerName,
            url: projectUrl,
            number: parseInt(projectNumber, 10),
        })
    }

    linkContentId = async (project: ProjectDetail, contentId: string, token: string) => {
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

        core.info(`Linked ${contentId} to organization project: ${linkResult.addProjectV2ItemById.item.id}`);
    }
}