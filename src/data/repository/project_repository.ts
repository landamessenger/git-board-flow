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

        core.info(`Project ID: ${projectData.id}`);
        core.info(`Project Title: ${projectData.title}`);
        core.info(`Project URL: ${projectData.url}`);

        return new ProjectDetail({
            id: projectData.id,
            title: projectData.title,
            url: projectData.url,
            type: ownerQueryField,
            owner: ownerName,
            number: parseInt(projectNumber, 10),
        });
    };

    isContentLinked = async (
        project: ProjectDetail,
        contentId: string,
        token: string
    ): Promise<boolean> => {
        const octokit = github.getOctokit(token);

        const query = `
    query($projectId: ID!) {
      node(id: $projectId) {
        ... on ProjectV2 {
          items(first: 100) {
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
          }
        }
      }
    }
  `;

        const result: any = await octokit.graphql(query, {
            projectId: project.id,
        });

        const items = result.node.items.nodes;
        return items.some(
            (item: any) => item.content && item.content.id === contentId
        );
    };

    linkContentId = async (project: ProjectDetail, contentId: string, token: string) => {
        const alreadyLinked = await this.isContentLinked(project, contentId, token);
        if (alreadyLinked) {
            core.info(`Content ${contentId} is already linked to project ${project.id}.`);
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

        core.info(`Linked ${contentId} to organization project: ${linkResult.addProjectV2ItemById.item.id}`);

        return true;
    }
}