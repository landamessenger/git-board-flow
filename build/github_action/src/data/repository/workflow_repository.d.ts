import { ProjectDetail } from "../model/project_detail";
import { Execution } from "../model/execution";
import { WorkflowRun } from "../model/workflow_run";
export declare class WorkflowRepository {
    private readonly priorityLabel;
    private readonly sizeLabel;
    private readonly statusLabel;
    /**
     * Retrieves detailed information about a GitHub project
     * @param projectId - The project number/ID
     * @param token - GitHub authentication token
     * @returns Promise<ProjectDetail> - The project details
     * @throws {Error} If the project is not found or if there are authentication/network issues
     */
    getProjectDetail: (projectId: string, token: string) => Promise<ProjectDetail>;
    getWorkflows: (params: Execution) => Promise<WorkflowRun[]>;
}
