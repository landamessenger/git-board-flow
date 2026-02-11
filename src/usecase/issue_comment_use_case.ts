import { Execution } from "../data/model/execution";
import { Result } from "../data/model/result";
import { logInfo } from "../utils/logger";
import { getTaskEmoji } from "../utils/task_emoji";
import { ThinkUseCase } from "./steps/common/think_use_case";
import { ParamUseCase } from "./base/param_usecase";
import { CheckIssueCommentLanguageUseCase } from "./steps/issue_comment/check_issue_comment_language_use_case";
import { DetectBugbotFixIntentUseCase } from "./steps/commit/bugbot/detect_bugbot_fix_intent_use_case";
import { BugbotAutofixUseCase } from "./steps/commit/bugbot/bugbot_autofix_use_case";
import { runBugbotAutofixCommitAndPush } from "./steps/commit/bugbot/bugbot_autofix_commit";
import { markFindingsResolved } from "./steps/commit/bugbot/mark_findings_resolved_use_case";
import { sanitizeFindingIdForMarker } from "./steps/commit/bugbot/marker";

type BugbotFixIntentPayload = {
    isFixRequest: boolean;
    targetFindingIds: string[];
    context?: Parameters<typeof markFindingsResolved>[0]["context"];
    branchOverride?: string;
};

function getBugbotFixIntentPayload(results: Result[]): BugbotFixIntentPayload | undefined {
    const last = results[results.length - 1];
    const payload = last?.payload;
    if (!payload || typeof payload !== "object") return undefined;
    return payload as BugbotFixIntentPayload;
}

function canRunBugbotAutofix(
    payload: BugbotFixIntentPayload | undefined
): payload is BugbotFixIntentPayload & { context: NonNullable<BugbotFixIntentPayload["context"]> } {
    return (
        !!payload?.isFixRequest &&
        Array.isArray(payload.targetFindingIds) &&
        payload.targetFindingIds.length > 0 &&
        !!payload.context
    );
}

export class IssueCommentUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = "IssueCommentUseCase";

    async invoke(param: Execution): Promise<Result[]> {
        logInfo(`${getTaskEmoji(this.taskId)} Executing ${this.taskId}.`);

        const results: Result[] = [];

        results.push(...(await new CheckIssueCommentLanguageUseCase().invoke(param)));

        const intentResults = await new DetectBugbotFixIntentUseCase().invoke(param);
        results.push(...intentResults);

        const intentPayload = getBugbotFixIntentPayload(intentResults);
        const runAutofix = canRunBugbotAutofix(intentPayload);

        if (intentPayload) {
            logInfo(
                `Bugbot fix intent: isFixRequest=${intentPayload.isFixRequest}, targetFindingIds=${intentPayload.targetFindingIds?.length ?? 0}.`
            );
        } else {
            logInfo("Bugbot fix intent: no payload from intent detection.");
        }

        if (runAutofix && intentPayload) {
            const payload = intentPayload;
            logInfo("Running bugbot autofix.");
            const userComment = param.issue.commentBody ?? "";
            const autofixResults = await new BugbotAutofixUseCase().invoke({
                execution: param,
                targetFindingIds: payload.targetFindingIds,
                userComment,
                context: payload.context,
                branchOverride: payload.branchOverride,
            });
            results.push(...autofixResults);

            const lastAutofix = autofixResults[autofixResults.length - 1];
            if (lastAutofix?.success) {
                logInfo("Bugbot autofix succeeded; running commit and push.");
                const commitResult = await runBugbotAutofixCommitAndPush(param, {
                    branchOverride: payload.branchOverride,
                });
                if (commitResult.committed && payload.context) {
                    const ids = payload.targetFindingIds;
                    const normalized = new Set(ids.map(sanitizeFindingIdForMarker));
                    await markFindingsResolved({
                        execution: param,
                        context: payload.context,
                        resolvedFindingIds: new Set(ids),
                        normalizedResolvedIds: normalized,
                    });
                    logInfo(`Marked ${ids.length} finding(s) as resolved.`);
                } else if (!commitResult.committed) {
                    logInfo("No commit performed (no changes or error).");
                }
            } else {
                logInfo("Bugbot autofix did not succeed; skipping commit.");
            }
        } else {
            logInfo("Skipping bugbot autofix (no fix request, no targets, or no context).");
        }

        if (!runAutofix) {
            logInfo("Running ThinkUseCase (comment was not a bugbot fix request).");
            results.push(...(await new ThinkUseCase().invoke(param)));
        }

        return results;
    }
}