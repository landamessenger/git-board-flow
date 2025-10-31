import { Execution } from "../data/model/execution";
import { WorkflowRun } from "../data/model/workflow_run";
import { WorkflowRepository } from "../data/repository/workflow_repository";
import { logDebugInfo } from "./logger";

export const waitForPreviousRuns = async (params: Execution): Promise<void> => {
    let attempts = 0;
    while (attempts < 200) { // máximo 200 intentos (por ejemplo)
      const activeRuns = await getActivePreviousRuns(params);
      if (activeRuns.length === 0) {
        logDebugInfo("✅ No previous runs active. Continuing...");
        return;
      }
  
      logDebugInfo(
        `⏳ Found ${activeRuns.length} previous run(s) still active. Waiting 20s...`
      );
      await new Promise((res) => setTimeout(res, 20000));
      attempts++;
    }
  
    throw new Error("Timeout waiting for previous runs to finish.");
}

const getActivePreviousRuns = async (params: Execution): Promise<WorkflowRun[]> => {
    const workflowRepository = new WorkflowRepository();
    const workflows = await workflowRepository.getWorkflows(params);
  
    const runId = parseInt(process.env.GITHUB_RUN_ID!, 10);
    const workflowName = process.env.GITHUB_WORKFLOW!;
    const activeStatuses = ["in_progress", "queued"];

    // logDebugInfo(`Active statuses: ${activeStatuses.join(', ')}`);
    logDebugInfo(`Run ID: ${runId}`);
    logDebugInfo(`Workflow name: ${workflowName}`);
    logDebugInfo(`Workflows: ${JSON.stringify(workflows, null, 2)}`);

    return workflows.filter((run) => {
      const isSameWorkflow = run.name === workflowName;
      const isPrevious = run.id < runId;
      const isActive = activeStatuses.includes(run.status!);
      return isSameWorkflow && isPrevious && isActive;
    });
  }
