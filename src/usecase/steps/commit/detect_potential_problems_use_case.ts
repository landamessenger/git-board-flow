import { Execution } from "../../../data/model/execution";
import { Result } from "../../../data/model/result";
import { AiRepository, OPENCODE_AGENT_PLAN } from "../../../data/repository/ai_repository";
import { BUGBOT_MAX_COMMENTS } from "../../../utils/constants";
import { logDebugInfo, logError, logInfo } from "../../../utils/logger";
import { ParamUseCase } from "../../base/param_usecase";
import { buildBugbotPrompt } from "./bugbot/build_bugbot_prompt";
import { deduplicateFindings } from "./bugbot/deduplicate_findings";
import { fileMatchesIgnorePatterns } from "./bugbot/file_ignore";
import { isSafeFindingFilePath } from "./bugbot/path_validation";
import { applyCommentLimit } from "./bugbot/limit_comments";
import { loadBugbotContext } from "./bugbot/load_bugbot_context_use_case";
import { markFindingsResolved } from "./bugbot/mark_findings_resolved_use_case";
import { publishFindings } from "./bugbot/publish_findings_use_case";
import { BUGBOT_RESPONSE_SCHEMA } from "./bugbot/schema";
import { meetsMinSeverity, normalizeMinSeverity } from "./bugbot/severity";
import { sanitizeFindingIdForMarker } from "./bugbot/marker";
import type { BugbotFinding } from "./bugbot/types";

export type { BugbotFinding } from "./bugbot/types";

export class DetectPotentialProblemsUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'DetectPotentialProblemsUseCase';

    private aiRepository = new AiRepository();

    async invoke(param: Execution): Promise<Result[]> {
        logInfo(`Executing ${this.taskId}.`);

        const results: Result[] = [];
        try {
            if (!param.ai?.getOpencodeModel() || !param.ai?.getOpencodeServerUrl()) {
                logDebugInfo('OpenCode not configured; skipping potential problems detection.');
                return results;
            }

            if (param.issueNumber === -1) {
                logDebugInfo('No issue number for this branch; skipping.');
                return results;
            }

            const context = await loadBugbotContext(param);
            const prompt = buildBugbotPrompt(param, context);
            logInfo('Detecting potential problems via OpenCode (agent computes changes and checks resolved)...');
            const response = await this.aiRepository.askAgent(param.ai, OPENCODE_AGENT_PLAN, prompt, {
                expectJson: true,
                schema: BUGBOT_RESPONSE_SCHEMA as unknown as Record<string, unknown>,
                schemaName: 'bugbot_findings',
            });

            if (response == null || typeof response !== 'object') {
                logDebugInfo('No response from OpenCode.');
                return results;
            }

            const payload = response as { findings?: BugbotFinding[]; resolved_finding_ids?: string[] };
            let findings = Array.isArray(payload.findings) ? payload.findings : [];
            const resolvedFindingIdsRaw = Array.isArray(payload.resolved_finding_ids) ? payload.resolved_finding_ids : [];
            const resolvedFindingIds = new Set(resolvedFindingIdsRaw);
            const normalizedResolvedIds = new Set(resolvedFindingIdsRaw.map(sanitizeFindingIdForMarker));

            const ignorePatterns = param.ai?.getAiIgnoreFiles?.() ?? [];
            const minSeverity = normalizeMinSeverity(param.ai?.getBugbotMinSeverity?.());
            findings = findings.filter(
                (f) => f.file == null || String(f.file).trim() === '' || isSafeFindingFilePath(f.file)
            );
            findings = findings.filter((f) => !fileMatchesIgnorePatterns(f.file, ignorePatterns));
            findings = findings.filter((f) => meetsMinSeverity(f.severity, minSeverity));
            findings = deduplicateFindings(findings);

            const maxComments = param.ai?.getBugbotCommentLimit?.() ?? BUGBOT_MAX_COMMENTS;
            const { toPublish, overflowCount, overflowTitles } = applyCommentLimit(findings, maxComments);

            if (toPublish.length === 0 && resolvedFindingIds.size === 0) {
                logDebugInfo('OpenCode returned no new findings (after filters) and no resolved ids.');
                results.push(
                    new Result({
                        id: this.taskId,
                        success: true,
                        executed: true,
                        steps: ['Potential problems detection completed (no new findings, no resolved).'],
                    })
                );
                return results;
            }

            await markFindingsResolved({
                execution: param,
                context,
                resolvedFindingIds,
                normalizedResolvedIds,
            });

            await publishFindings({
                execution: param,
                context,
                findings: toPublish,
                overflowCount: overflowCount > 0 ? overflowCount : undefined,
                overflowTitles: overflowCount > 0 ? overflowTitles : undefined,
            });

            const stepParts = [`${toPublish.length} new/current finding(s) from OpenCode`];
            if (overflowCount > 0) {
                stepParts.push(`${overflowCount} more not published (see summary comment)`);
            }
            if (resolvedFindingIds.size > 0) {
                stepParts.push(`${resolvedFindingIds.size} marked as resolved by OpenCode`);
            }
            results.push(
                new Result({
                    id: this.taskId,
                    success: true,
                    executed: true,
                    steps: [`Potential problems detection completed. ${stepParts.join('; ')}.`],
                })
            );
        } catch (error) {
            logError(`Error in ${this.taskId}: ${error}`);
            results.push(
                new Result({
                    id: this.taskId,
                    success: false,
                    executed: true,
                    errors: [`Error in ${this.taskId}: ${error}`],
                })
            );
        }
        return results;
    }
}
