import { Execution } from "../data/model/execution";
import { Result } from "../data/model/result";
import { logInfo } from "../utils/logger";
import { getTaskEmoji } from "../utils/task_emoji";
import { ParamUseCase } from "./base/param_usecase";
import { CheckPullRequestCommentLanguageUseCase } from "./steps/pull_request_review_comment/check_pull_request_comment_language_use_case";
import {
    DetectBugbotFixIntentUseCase,
    type BugbotFixIntent,
} from "./steps/commit/bugbot/detect_bugbot_fix_intent_use_case";
import { BugbotAutofixUseCase } from "./steps/commit/bugbot/bugbot_autofix_use_case";
import { runBugbotAutofixCommitAndPush } from "./steps/commit/bugbot/bugbot_autofix_commit";
import { markFindingsResolved } from "./steps/commit/bugbot/mark_findings_resolved_use_case";
import { sanitizeFindingIdForMarker } from "./steps/commit/bugbot/marker";

export class PullRequestReviewCommentUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = "PullRequestReviewCommentUseCase";

    async invoke(param: Execution): Promise<Result[]> {
        logInfo(`${getTaskEmoji(this.taskId)} Executing ${this.taskId}.`);

        const results: Result[] = [];

        results.push(...(await new CheckPullRequestCommentLanguageUseCase().invoke(param)));

        const intentResults = await new DetectBugbotFixIntentUseCase().invoke(param);
        results.push(...intentResults);

        const intentPayload = intentResults[intentResults.length - 1]?.payload as
            | (BugbotFixIntent & { context?: Parameters<typeof markFindingsResolved>[0]["context"]; branchOverride?: string })
            | undefined;

        if (
            intentPayload?.isFixRequest &&
            Array.isArray(intentPayload.targetFindingIds) &&
            intentPayload.targetFindingIds.length > 0 &&
            intentPayload.context
        ) {
            const userComment = param.pullRequest.commentBody ?? "";
            const autofixResults = await new BugbotAutofixUseCase().invoke({
                execution: param,
                targetFindingIds: intentPayload.targetFindingIds,
                userComment,
                context: intentPayload.context,
                branchOverride: intentPayload.branchOverride,
            });
            results.push(...autofixResults);

            const lastAutofix = autofixResults[autofixResults.length - 1];
            if (lastAutofix?.success) {
                const commitResult = await runBugbotAutofixCommitAndPush(param, {
                    branchOverride: intentPayload.branchOverride,
                });
                if (commitResult.committed && intentPayload.context) {
                    const ids = intentPayload.targetFindingIds as string[];
                    const normalized = new Set(ids.map(sanitizeFindingIdForMarker));
                    await markFindingsResolved({
                        execution: param,
                        context: intentPayload.context,
                        resolvedFindingIds: new Set(ids),
                        normalizedResolvedIds: normalized,
                    });
                }
            }
        }

        return results;
    }
}