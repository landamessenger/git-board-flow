import type { Execution } from "../../../../data/model/execution";
import { AiRepository } from "../../../../data/repository/ai_repository";
import { logDebugInfo, logError, logInfo } from "../../../../utils/logger";
import { getTaskEmoji } from "../../../../utils/task_emoji";
import { ParamUseCase } from "../../../base/param_usecase";
import { Result } from "../../../../data/model/result";
import type { BugbotContext } from "./types";
import { buildBugbotFixPrompt } from "./build_bugbot_fix_prompt";
import { loadBugbotContext } from "./load_bugbot_context_use_case";

const TASK_ID = "BugbotAutofixUseCase";

export interface BugbotAutofixParam {
    execution: Execution;
    targetFindingIds: string[];
    userComment: string;
    /** If provided (e.g. from intent step), reuse to avoid reloading. */
    context?: BugbotContext;
    branchOverride?: string;
}

/**
 * Runs the OpenCode build agent to fix the selected bugbot findings.
 * OpenCode applies changes directly in the workspace. Caller is responsible for
 * running verify commands and commit/push after this returns success.
 */
export class BugbotAutofixUseCase implements ParamUseCase<BugbotAutofixParam, Result[]> {
    taskId: string = TASK_ID;

    private aiRepository = new AiRepository();

    async invoke(param: BugbotAutofixParam): Promise<Result[]> {
        logInfo(`${getTaskEmoji(this.taskId)} Executing ${this.taskId}.`);

        const results: Result[] = [];
        const { execution, targetFindingIds, userComment, context: providedContext, branchOverride } = param;

        if (targetFindingIds.length === 0) {
            logDebugInfo("No target finding ids; skipping autofix.");
            return results;
        }

        if (!execution.ai?.getOpencodeServerUrl() || !execution.ai?.getOpencodeModel()) {
            logDebugInfo("OpenCode not configured; skipping autofix.");
            return results;
        }

        const context = providedContext ?? (await loadBugbotContext(execution, branchOverride ? { branchOverride } : undefined));

        const validIds = new Set(
            Object.entries(context.existingByFindingId)
                .filter(([, info]) => !info.resolved)
                .map(([id]) => id)
        );
        const idsToFix = targetFindingIds.filter((id) => validIds.has(id));
        if (idsToFix.length === 0) {
            logDebugInfo("No valid unresolved target findings; skipping autofix.");
            return results;
        }

        const verifyCommands = execution.ai.getBugbotFixVerifyCommands?.() ?? [];
        const prompt = buildBugbotFixPrompt(execution, context, idsToFix, userComment, verifyCommands);

        logInfo("Running OpenCode build agent to fix selected findings (changes applied in workspace).");
        const response = await this.aiRepository.copilotMessage(execution.ai, prompt);

        if (!response?.text) {
            logError("Bugbot autofix: no response from OpenCode build agent.");
            results.push(
                new Result({
                    id: this.taskId,
                    success: false,
                    executed: true,
                    errors: ["OpenCode build agent returned no response."],
                })
            );
            return results;
        }

        results.push(
            new Result({
                id: this.taskId,
                success: true,
                executed: true,
                steps: [
                    `Bugbot autofix completed. OpenCode applied changes for findings: ${idsToFix.join(", ")}. Run verify commands and commit/push.`,
                ],
                payload: { targetFindingIds: idsToFix, context },
            })
        );
        return results;
    }
}
