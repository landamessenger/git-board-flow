import { Execution } from "../data/model/execution";
import { WorkflowRepository } from "../data/repository/workflow_repository";
import { logDebugInfo } from "./logger";

export const waitForPreviousRuns = async (params: Execution): Promise<void> => {
    let attempts = 0;
    while (attempts < 800) {
      const workflowRepository = new WorkflowRepository();
      const activeRuns = await workflowRepository.getActivePreviousRuns(params);
      if (activeRuns.length === 0) {
        logDebugInfo("✅ No previous runs active. Continuing...");
        return;
      }
  
      logDebugInfo(
        `⏳ Found ${activeRuns.length} previous run(s) still active. Waiting 5s...`
      );
      await new Promise((res) => setTimeout(res, 5000));
      attempts++;
    }
  
    throw new Error("Timeout waiting for previous runs to finish.");
}
