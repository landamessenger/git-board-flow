import { Execution } from "../data/model/execution";
import { Result } from "../data/model/result";
import { logInfo } from "../utils/logger";
import { getTaskEmoji } from "../utils/task_emoji";
import { ThinkUseCase } from "./steps/common/think_use_case";
import { ParamUseCase } from "./base/param_usecase";
import { CheckPullRequestCommentLanguageUseCase } from "./steps/pull_request_review_comment/check_pull_request_comment_language_use_case";
import { DetectBugbotFixIntentUseCase } from "./steps/commit/bugbot/detect_bugbot_fix_intent_use_case";
import { BugbotAutofixUseCase } from "./steps/commit/bugbot/bugbot_autofix_use_case";
import { runBugbotAutofixCommitAndPush } from "./steps/commit/bugbot/bugbot_autofix_commit";
import { markFindingsResolved } from "./steps/commit/bugbot/mark_findings_resolved_use_case";
import { sanitizeFindingIdForMarker } from "./steps/commit/bugbot/marker";
import {
    getBugbotFixIntentPayload,
    canRunBugbotAutofix,
} from "./steps/commit/bugbot/bugbot_fix_intent_payload";

export class PullRequestReviewCommentUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = "PullRequestReviewCommentUseCase";

    async invoke(param: Execution): Promise<Result[]> {
        logInfo(`${getTaskEmoji(this.taskId)} Executing ${this.taskId}.`);

        const results: Result[] = [];

        results.push(...(await new CheckPullRequestCommentLanguageUseCase().invoke(param)));

        logInfo("Running bugbot fix intent detection (before Think).");
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
            const userComment = param.pullRequest.commentBody ?? "";
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
                    targetFindingIds: payload.targetFindingIds,
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
