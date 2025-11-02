import { Execution } from "../model/execution";
import { WorkflowRun } from "../model/workflow_run";
export declare class WorkflowRepository {
    getWorkflows: (params: Execution) => Promise<WorkflowRun[]>;
    getActivePreviousRuns: (params: Execution) => Promise<WorkflowRun[]>;
}
