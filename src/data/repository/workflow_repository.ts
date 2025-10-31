import * as github from "@actions/github";
import { Execution } from "../model/execution";
import { WorkflowRun } from "../model/workflow_run";
import { WORKFLOW_ACTIVE_STATUSES } from "../../utils/constants";


export class WorkflowRepository {

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

    getActivePreviousRuns = async (params: Execution): Promise<WorkflowRun[]> => {
        const workflows = await this.getWorkflows(params);
      
        const runId = parseInt(process.env.GITHUB_RUN_ID!, 10);
        const workflowName = process.env.GITHUB_WORKFLOW!;
    
        return workflows.filter((run) => {
            const isSameWorkflow = run.name === workflowName;
            const isPrevious = run.id < runId;
            const isActive = WORKFLOW_ACTIVE_STATUSES.includes(run.status!);
            return isSameWorkflow && isPrevious && isActive;
        });
    }
}