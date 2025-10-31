import * as github from "@actions/github";
import * as core from '@actions/core';
import { logDebugInfo, logError, logInfo } from "../../utils/logger";
import { ProjectResult } from "../graph/project_result";
import { ProjectDetail } from "../model/project_detail";
import { context } from "@actions/github";
import { Workflows } from "../model/workflows";
import { Execution } from "../model/execution";
import { WorkflowRun } from "../model/workflow_run";


export class WorkflowRepository {
  
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

    getWorkflows = async (params: Execution): Promise<WorkflowRun[]> => {
        const octokit = github.getOctokit(params.tokens.token);
        const workflows = await octokit.rest.actions.listWorkflowRunsForRepo({
            owner: params.owner,
            repo: params.repo,
        });
        return workflows.data.workflow_runs.map(
            w => new WorkflowRun({
                id: w.id,
                name: w.name ?? 'unknown',
                head_branch: w.head_branch,
                head_sha: w.head_sha,
                run_number: w.run_number,
                event: w.event,
                status: w.status ?? 'unknown',
                conclusion: w.conclusion ?? null,
                created_at: w.created_at,
                updated_at: w.updated_at,
                url: w.url,
                html_url: w.html_url,
            })
        );
    }
}