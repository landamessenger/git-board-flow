/**
 * Use case that performs whatever changes the user asked for (generic request).
 * Uses the OpenCode build agent to edit files and run commands in the workspace.
 * Caller is responsible for permission check and for running commit/push after success.
 */

import type { Execution } from "../../../data/model/execution";
import { AiRepository } from "../../../data/repository/ai_repository";
import { logError, logInfo } from "../../../utils/logger";
import { getTaskEmoji } from "../../../utils/task_emoji";
import { ParamUseCase } from "../../base/param_usecase";
import { Result } from "../../../data/model/result";
import { OPENCODE_PROJECT_CONTEXT_INSTRUCTION } from "../../../utils/opencode_project_context_instruction";
import { sanitizeUserCommentForPrompt } from "./bugbot/sanitize_user_comment_for_prompt";

const TASK_ID = "DoUserRequestUseCase";

export interface DoUserRequestParam {
    execution: Execution;
    userComment: string;
    branchOverride?: string;
}

function buildUserRequestPrompt(execution: Execution, userComment: string): string {
    const headBranch = execution.commit.branch;
    const baseBranch =
        execution.currentConfiguration.parentBranch ?? execution.branches.development ?? "develop";
    const issueNumber = execution.issueNumber;
    const owner = execution.owner;
    const repo = execution.repo;

    return `You are in the repository workspace. The user has asked you to do something. Perform their request by editing files and running commands directly in the workspace. Do not output diffs for someone else to apply.

${OPENCODE_PROJECT_CONTEXT_INSTRUCTION}

**Repository context:**
- Owner: ${owner}
- Repository: ${repo}
- Branch (head): ${headBranch}
- Base branch: ${baseBranch}
- Issue number: ${issueNumber}

**User request:**
"""
${sanitizeUserCommentForPrompt(userComment)}
"""

**Rules:**
1. Apply all changes directly in the workspace (edit files, run commands).
2. If the project has standard checks (build, test, lint), run them and ensure they pass when relevant.
3. Reply briefly confirming what you did.`;
}

export class DoUserRequestUseCase implements ParamUseCase<DoUserRequestParam, Result[]> {
    taskId: string = TASK_ID;

    private aiRepository = new AiRepository();

    async invoke(param: DoUserRequestParam): Promise<Result[]> {
        logInfo(`${getTaskEmoji(this.taskId)} Executing ${this.taskId}.`);

        const results: Result[] = [];
        const { execution, userComment } = param;

        if (!execution.ai?.getOpencodeServerUrl() || !execution.ai?.getOpencodeModel()) {
            logInfo("OpenCode not configured; skipping user request.");
            return results;
        }

        const commentTrimmed = userComment?.trim() ?? "";
        if (!commentTrimmed) {
            logInfo("No user comment; skipping user request.");
            return results;
        }

        const prompt = buildUserRequestPrompt(execution, userComment);

        logInfo("Running OpenCode build agent to perform user request (changes applied in workspace).");
        const response = await this.aiRepository.copilotMessage(execution.ai, prompt);

        if (!response?.text) {
            logError("DoUserRequest: no response from OpenCode build agent.");
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
                steps: [],
                payload: { branchOverride: param.branchOverride },
            })
        );
        return results;
    }
}
