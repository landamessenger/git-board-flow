import { Execution } from "../model/execution";
import { WorkflowRun } from "../model/workflow_run";
export declare class WorkflowRepository {
    getWorkflows: (params: Execution) => Promise<WorkflowRun[]>;
    getActivePreviousRuns: (params: Execution) => Promise<WorkflowRun[]>;
    executeWorkflow: (owner: string, repository: string, branch: string, workflow: string, inputs: Record<string, unknown>, token: string) => Promise<import("@octokit/plugin-paginate-rest/dist-types/types").OctokitResponse<never, 204>>;
}
