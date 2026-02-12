/**
 * After autofix (or when OpenCode returns resolved_finding_ids in detection), we mark those
 * findings as resolved: update the issue comment with a "Resolved" note and set resolved:true
 * in the marker; update the PR review comment marker and resolve the review thread.
 */

import type { Execution } from "../../../../data/model/execution";
import { IssueRepository } from "../../../../data/repository/issue_repository";
import { PullRequestRepository } from "../../../../data/repository/pull_request_repository";
import { logDebugInfo, logError } from "../../../../utils/logger";
import type { BugbotContext } from "./types";
import { buildMarker, replaceMarkerInBody, sanitizeFindingIdForMarker } from "./marker";

export interface MarkFindingsResolvedParam {
    execution: Execution;
    context: BugbotContext;
    resolvedFindingIds: Set<string>;
    normalizedResolvedIds: Set<string>;
}

/**
 * Marks as resolved the findings that OpenCode reported as fixed.
 * Updates issue comments (with visible "Resolved" note) and PR review comments (marker only + resolve thread).
 */
export async function markFindingsResolved(param: MarkFindingsResolvedParam): Promise<void> {
    const { execution, context, resolvedFindingIds, normalizedResolvedIds } = param;
    const { existingByFindingId, issueComments } = context;
    const issueNumber = execution.issueNumber;
    const token = execution.tokens.token;
    const owner = execution.owner;
    const repo = execution.repo;

    const issueRepository = new IssueRepository();
    const pullRequestRepository = new PullRequestRepository();

    for (const [findingId, existing] of Object.entries(existingByFindingId)) {
        const isResolvedByOpenCode =
            resolvedFindingIds.has(findingId) ||
            normalizedResolvedIds.has(sanitizeFindingIdForMarker(findingId));
        if (existing.resolved || !isResolvedByOpenCode) continue;

        const resolvedNote = '\n\n---\n**Resolved** (OpenCode confirmed fixed in latest analysis).\n';
        const markerTrue = buildMarker(findingId, true);
        const replacementWithNote = resolvedNote + markerTrue;

        if (existing.issueCommentId != null) {
            const comment = issueComments.find((c) => c.id === existing.issueCommentId);
            if (comment == null) {
                logError(
                    `[Bugbot] No se encontró el comentario de la issue para marcar como resuelto. findingId="${findingId}", issueCommentId=${existing.issueCommentId}, issueNumber=${issueNumber}, owner=${owner}, repo=${repo}.`
                );
            } else {
                const resolvedBody = comment.body ?? '';
                const { updated, replaced } = replaceMarkerInBody(
                    resolvedBody,
                    findingId,
                    true,
                    replacementWithNote
                );
                if (replaced) {
                    try {
                        await issueRepository.updateComment(
                            owner,
                            repo,
                            issueNumber,
                            existing.issueCommentId,
                            updated.trimEnd(),
                            token
                        );
                        logDebugInfo(`Marked finding "${findingId}" as resolved on issue #${issueNumber} (comment ${existing.issueCommentId}).`);
                    } catch (err) {
                        logError(
                            `[Bugbot] Error al actualizar comentario de la issue (marcar como resuelto). findingId="${findingId}", issueCommentId=${existing.issueCommentId}, issueNumber=${issueNumber}: ${err}`
                        );
                    }
                }
            }
        }
        if (existing.prCommentId != null && existing.prNumber != null) {
            const prCommentsList = await pullRequestRepository.listPullRequestReviewComments(
                owner,
                repo,
                existing.prNumber,
                token
            );
            const prComment = prCommentsList.find((c) => c.id === existing.prCommentId);
            if (prComment == null) {
                logError(
                    `[Bugbot] No se encontró el comentario de la PR para marcar como resuelto. findingId="${findingId}", prCommentId=${existing.prCommentId}, prNumber=${existing.prNumber}, owner=${owner}, repo=${repo}.`
                );
            } else {
                const prBody = prComment.body ?? '';
                const { updated, replaced } = replaceMarkerInBody(
                    prBody,
                    findingId,
                    true,
                    markerTrue
                );
                if (replaced) {
                    try {
                        await pullRequestRepository.updatePullRequestReviewComment(
                            owner,
                            repo,
                            existing.prCommentId,
                            updated.trimEnd(),
                            token
                        );
                        logDebugInfo(
                            `Marked finding "${findingId}" as resolved on PR #${existing.prNumber} (review comment ${existing.prCommentId}).`
                        );
                        if (prComment.node_id) {
                            await pullRequestRepository.resolvePullRequestReviewThread(
                                owner,
                                repo,
                                existing.prNumber,
                                prComment.node_id,
                                token
                            );
                        }
                    } catch (err) {
                        logError(
                            `[Bugbot] Error al actualizar comentario de revisión de la PR (marcar como resuelto). findingId="${findingId}", prCommentId=${existing.prCommentId}, prNumber=${existing.prNumber}: ${err}`
                        );
                    }
                }
            }
        }
    }
}
