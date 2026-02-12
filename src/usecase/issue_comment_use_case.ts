import { Execution } from "../data/model/execution";
import { Result } from "../data/model/result";
import { logInfo } from "../utils/logger";
import { getTaskEmoji } from "../utils/task_emoji";
import { ThinkUseCase } from "./steps/common/think_use_case";
import { ParamUseCase } from "./base/param_usecase";
import { CheckIssueCommentLanguageUseCase } from "./steps/issue_comment/check_issue_comment_language_use_case";
import { DetectBugbotFixIntentUseCase } from "./steps/commit/bugbot/detect_bugbot_fix_intent_use_case";
import { BugbotAutofixUseCase } from "./steps/commit/bugbot/bugbot_autofix_use_case";
import { runBugbotAutofixCommitAndPush, runUserRequestCommitAndPush } from "./steps/commit/bugbot/bugbot_autofix_commit";
import { markFindingsResolved } from "./steps/commit/bugbot/mark_findings_resolved_use_case";
import { sanitizeFindingIdForMarker } from "./steps/commit/bugbot/marker";
import {
    getBugbotFixIntentPayload,
    canRunBugbotAutofix,
    canRunDoUserRequest,
} from "./steps/commit/bugbot/bugbot_fix_intent_payload";
import { DoUserRequestUseCase } from "./steps/commit/user_request_use_case";
import { ProjectRepository } from "../data/repository/project_repository";

export class IssueCommentUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = "IssueCommentUseCase";

    async invoke(param: Execution): Promise<Result[]> {
        logInfo(`${getTaskEmoji(this.taskId)} Executing ${this.taskId}.`);

        const results: Result[] = [];

        results.push(...(await new CheckIssueCommentLanguageUseCase().invoke(param)));

        logInfo("Running bugbot fix intent detection (before Think).");
        const intentResults = await new DetectBugbotFixIntentUseCase().invoke(param);
        results.push(...intentResults);

        const intentPayload = getBugbotFixIntentPayload(intentResults);
        const runAutofix = canRunBugbotAutofix(intentPayload);

        if (intentPayload) {
            logInfo(
                `Bugbot fix intent: isFixRequest=${intentPayload.isFixRequest}, isDoRequest=${intentPayload.isDoRequest}, targetFindingIds=${intentPayload.targetFindingIds?.length ?? 0}.`
            );
        } else {
            logInfo("Bugbot fix intent: no payload from intent detection.");
        }

        const projectRepository = new ProjectRepository();
        const allowedToModifyFiles = await projectRepository.isActorAllowedToModifyFiles(
            param.owner,
            param.actor,
            param.tokens.token
        );
        if (!allowedToModifyFiles && (runAutofix || canRunDoUserRequest(intentPayload))) {
            logInfo(
                "Skipping file-modifying use cases: user is not an org member or repo owner."
            );
        }

        if (runAutofix && intentPayload && allowedToModifyFiles) {
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

            const lastAutofix =
                autofixResults.length > 0 ? autofixResults[autofixResults.length - 1] : undefined;
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
        } else if (!runAutofix && canRunDoUserRequest(intentPayload) && allowedToModifyFiles) {
            const payload = intentPayload!;
            logInfo("Running do user request.");
            const userComment = param.issue.commentBody ?? "";
            const doResults = await new DoUserRequestUseCase().invoke({
                execution: param,
                userComment,
                branchOverride: payload.branchOverride,
            });
            results.push(...doResults);

            const lastDo = doResults[doResults.length - 1];
            if (lastDo?.success) {
                logInfo("Do user request succeeded; running commit and push.");
                await runUserRequestCommitAndPush(param, {
                    branchOverride: payload.branchOverride,
                });
            } else {
                logInfo("Do user request did not succeed; skipping commit.");
            }
        } else if (!runAutofix) {
            logInfo("Skipping bugbot autofix (no fix request, no targets, or no context).");
        }

        const ranAutofix = runAutofix && allowedToModifyFiles && intentPayload;
        const ranDoRequest = canRunDoUserRequest(intentPayload) && allowedToModifyFiles;
        if (!ranAutofix && !ranDoRequest) {
            logInfo("Running ThinkUseCase (no file-modifying action ran).");
            results.push(...(await new ThinkUseCase().invoke(param)));
        }

        return results;
    }
}