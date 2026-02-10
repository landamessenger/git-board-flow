import { Execution } from "../../../data/model/execution";
import { Result } from "../../../data/model/result";
import { AiRepository, OPENCODE_AGENT_PLAN } from "../../../data/repository/ai_repository";
import { IssueRepository } from "../../../data/repository/issue_repository";
import { PullRequestRepository } from "../../../data/repository/pull_request_repository";
import { logDebugInfo, logError, logInfo } from "../../../utils/logger";
import { BUGBOT_MARKER_PREFIX } from "../../../utils/constants";
import { ParamUseCase } from "../../base/param_usecase";

/** Single finding from OpenCode (agent computes changes and returns these). */
export interface BugbotFinding {
    id: string;
    title: string;
    description: string;
    file?: string;
    line?: number;
    severity?: string;
    suggestion?: string;
}

/** OpenCode response schema: agent computes diff, returns new findings and which previous ones are resolved. */
const BUGBOT_RESPONSE_SCHEMA = {
    type: 'object',
    properties: {
        findings: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Stable unique id for this finding (e.g. file:line:summary)' },
                    title: { type: 'string', description: 'Short title of the problem' },
                    description: { type: 'string', description: 'Clear explanation of the issue' },
                    file: { type: 'string', description: 'Repository-relative path when applicable' },
                    line: { type: 'number', description: 'Line number when applicable' },
                    severity: { type: 'string', description: 'e.g. high, medium, low' },
                    suggestion: { type: 'string', description: 'Suggested fix when applicable' },
                },
                required: ['id', 'title', 'description'],
                additionalProperties: true,
            },
        },
        resolved_finding_ids: {
            type: 'array',
            items: { type: 'string' },
            description:
                'Ids of previously reported issues (from the list we sent) that are now fixed in the current code. Only include ids we asked you to check.',
        },
    },
    required: ['findings'],
    additionalProperties: false,
} as const;

/** Sanitize finding ID so it cannot break HTML comment syntax (e.g. -->, <!, <, >, newlines, quotes). */
function sanitizeFindingIdForMarker(findingId: string): string {
    return findingId
        .replace(/-->/g, '')
        .replace(/<!/g, '')
        .replace(/</g, '')
        .replace(/>/g, '')
        .replace(/"/g, '')
        .replace(/\r\n|\r|\n/g, '')
        .trim();
}

function buildMarker(findingId: string, resolved: boolean): string {
    const safeId = sanitizeFindingIdForMarker(findingId);
    return `<!-- ${BUGBOT_MARKER_PREFIX} finding_id:"${safeId}" resolved:${resolved} -->`;
}

function parseMarker(body: string | null): Array<{ findingId: string; resolved: boolean }> {
    if (!body) return [];
    const results: Array<{ findingId: string; resolved: boolean }> = [];
    const regex = new RegExp(
        `<!--\\s*${BUGBOT_MARKER_PREFIX}\\s+finding_id:\\s*"([^"]+)"\\s+resolved:(true|false)\\s*-->`,
        'g'
    );
    let m: RegExpExecArray | null;
    while ((m = regex.exec(body)) !== null) {
        results.push({ findingId: m[1], resolved: m[2] === 'true' });
    }
    return results;
}

/** Regex to match the marker for a specific finding (same flexible format as parseMarker). */
function markerRegexForFinding(findingId: string): RegExp {
    const safeId = sanitizeFindingIdForMarker(findingId);
    const escapedId = safeId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(
        `<!--\\s*${BUGBOT_MARKER_PREFIX}\\s+finding_id:\\s*"${escapedId}"\\s+resolved:(?:true|false)\\s*-->`,
        'g'
    );
}

/**
 * Find the marker for this finding in body (using same pattern as parseMarker) and replace it.
 * Returns the updated body and whether a replacement was made. Logs an error with details if no replacement occurred.
 */
function replaceMarkerInBody(
    body: string,
    findingId: string,
    newResolved: boolean,
    replacement?: string
): { updated: string; replaced: boolean } {
    const regex = markerRegexForFinding(findingId);
    const newMarker = replacement ?? buildMarker(findingId, newResolved);
    const updated = body.replace(regex, newMarker);
    const replaced = updated !== body;
    if (!replaced) {
        logError(
            `[Bugbot] No se pudo marcar como resuelto: no se encontró el marcador en el comentario. findingId="${findingId}", bodyLength=${body?.length ?? 0}, bodySnippet=${(body ?? '').slice(0, 200)}...`
        );
    }
    return { updated, replaced };
}

/** Extract title from comment body (first ## line) for context when sending to OpenCode. */
function extractTitleFromBody(body: string | null): string {
    if (!body) return '';
    const match = body.match(/^##\s+(.+)$/m);
    return (match?.[1] ?? '').trim();
}

function buildCommentBody(finding: BugbotFinding, resolved: boolean): string {
    const severity = finding.severity ? `**Severity:** ${finding.severity}\n\n` : '';
    const fileLine =
        finding.file != null
            ? `**Location:** \`${finding.file}${finding.line != null ? `:${finding.line}` : ''}\`\n\n`
            : '';
    const suggestion = finding.suggestion
        ? `**Suggested fix:**\n${finding.suggestion}\n\n`
        : '';
    const resolvedNote = resolved ? '\n\n---\n**Resolved** (no longer reported in latest analysis).\n' : '';
    const marker = buildMarker(finding.id, resolved);
    return `## ${finding.title}

${severity}${fileLine}${finding.description}
${suggestion}${resolvedNote}${marker}`;
}

export class DetectPotentialProblemsUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'DetectPotentialProblemsUseCase';

    private issueRepository = new IssueRepository();
    private pullRequestRepository = new PullRequestRepository();
    private aiRepository = new AiRepository();

    async invoke(param: Execution): Promise<Result[]> {
        logInfo(`Executing ${this.taskId}.`);

        const results: Result[] = [];
        try {
            if (!param.ai?.getOpencodeModel() || !param.ai?.getOpencodeServerUrl()) {
                logDebugInfo('OpenCode not configured; skipping potential problems detection.');
                return results;
            }

            const issueNumber = param.issueNumber;
            if (issueNumber === -1) {
                logDebugInfo('No issue number for this branch; skipping.');
                return results;
            }

            const headBranch = param.commit.branch;
            const baseBranch = param.currentConfiguration.parentBranch ?? param.branches.development ?? 'develop';
            const token = param.tokens.token;
            const owner = param.owner;
            const repo = param.repo;

            const issueComments = await this.issueRepository.listIssueComments(owner, repo, issueNumber, token);
            const existingByFindingId: Record<
                string,
                { issueCommentId?: number; prCommentId?: number; prNumber?: number; resolved: boolean }
            > = {};
            for (const c of issueComments) {
                for (const { findingId, resolved } of parseMarker(c.body)) {
                    if (!existingByFindingId[findingId]) {
                        existingByFindingId[findingId] = { issueCommentId: c.id, resolved };
                    } else {
                        existingByFindingId[findingId].issueCommentId = c.id;
                        existingByFindingId[findingId].resolved = resolved;
                    }
                }
            }

            const openPrNumbers = await this.pullRequestRepository.getOpenPullRequestNumbersByHeadBranch(
                owner,
                repo,
                headBranch,
                token
            );

            for (const prNumber of openPrNumbers) {
                const prComments = await this.pullRequestRepository.listPullRequestReviewComments(
                    owner,
                    repo,
                    prNumber,
                    token
                );
                for (const c of prComments) {
                    for (const { findingId, resolved } of parseMarker(c.body)) {
                        if (!existingByFindingId[findingId]) {
                            existingByFindingId[findingId] = { resolved };
                        }
                        existingByFindingId[findingId].prCommentId = c.id;
                        existingByFindingId[findingId].prNumber = prNumber;
                        existingByFindingId[findingId].resolved = resolved;
                    }
                }
            }

            const previousFindingsForPrompt: Array<{ id: string; title: string }> = [];
            for (const [findingId, data] of Object.entries(existingByFindingId)) {
                if (data.resolved) continue;
                const comment = issueComments.find((c) => c.id === data.issueCommentId);
                const title = extractTitleFromBody(comment?.body ?? null) || findingId;
                previousFindingsForPrompt.push({ id: findingId, title });
            }

            const previousBlock =
                previousFindingsForPrompt.length > 0
                    ? `
**Previously reported issues (from our comments, not yet marked resolved):**
${previousFindingsForPrompt.map((p) => `- id: "${p.id.replace(/"/g, '\\"')}" title: ${JSON.stringify(p.title)}`).join('\n')}

After analyzing the current code, return in \`resolved_finding_ids\` the ids of the above that are now fixed (the problem is no longer present). Only include ids from this list.`
                    : '';

            const prompt = `You are analyzing the latest code changes for potential bugs and issues.

**Repository context:**
- Owner: ${param.owner}
- Repository: ${param.repo}
- Branch (head): ${headBranch}
- Base branch: ${baseBranch}
- Issue number: ${issueNumber}

**Your task 1:** Determine what has changed in the branch "${headBranch}" compared to "${baseBranch}" (you must compute or obtain the diff yourself using the repository context above). Then identify potential bugs, logic errors, security issues, and code quality problems. Be strict and descriptive. One finding per distinct problem. Return them in the \`findings\` array (each with id, title, description; optionally file, line, severity, suggestion).
${previousBlock}

Return a JSON object with: "findings" (array of new/current problems), and if we gave you a list of previously reported issues above, "resolved_finding_ids" (array of those ids that are now fixed in the current code).`;

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
            const findings = Array.isArray(payload.findings) ? payload.findings : [];
            const resolvedFindingIdsRaw = Array.isArray(payload.resolved_finding_ids) ? payload.resolved_finding_ids : [];
            const resolvedFindingIds = new Set(resolvedFindingIdsRaw);
            const normalizedResolvedIds = new Set(resolvedFindingIdsRaw.map(sanitizeFindingIdForMarker));

            if (findings.length === 0 && resolvedFindingIds.size === 0) {
                logDebugInfo('OpenCode returned no new findings and no resolved ids.');
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

            const currentIds = new Set(findings.map((f) => f.id));
            const prCommentsToCreate: Array<{ path: string; line: number; body: string }> = [];
            let prHeadSha: string | undefined;
            let prFiles: { filename: string; status: string }[] = [];
            const pathToFirstDiffLine: Record<string, number> = {};

            if (openPrNumbers.length > 0) {
                prHeadSha = await this.pullRequestRepository.getPullRequestHeadSha(
                    owner,
                    repo,
                    openPrNumbers[0],
                    token
                );
                if (prHeadSha) {
                    prFiles = await this.pullRequestRepository.getChangedFiles(
                        owner,
                        repo,
                        openPrNumbers[0],
                        token
                    );
                    const filesWithLines = await this.pullRequestRepository.getFilesWithFirstDiffLine(
                        owner,
                        repo,
                        openPrNumbers[0],
                        token
                    );
                    for (const { path, firstLine } of filesWithLines) {
                        pathToFirstDiffLine[path] = firstLine;
                    }
                }
            }

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
                                await this.issueRepository.updateComment(
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
                    const prCommentsList = await this.pullRequestRepository.listPullRequestReviewComments(
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
                                await this.pullRequestRepository.updatePullRequestReviewComment(
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
                                    await this.pullRequestRepository.resolvePullRequestReviewThread(
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

            for (const finding of findings) {
                const existing = existingByFindingId[finding.id];
                const commentBody = buildCommentBody(finding, false);

                if (existing?.issueCommentId != null) {
                    await this.issueRepository.updateComment(
                        owner,
                        repo,
                        issueNumber,
                        existing.issueCommentId,
                        commentBody,
                        token
                    );
                    logDebugInfo(`Updated bugbot comment for finding ${finding.id} on issue.`);
                } else {
                    await this.issueRepository.addComment(owner, repo, issueNumber, commentBody, token);
                    logDebugInfo(`Added bugbot comment for finding ${finding.id} on issue.`);
                }

                if (prHeadSha && openPrNumbers.length > 0) {
                    const path = finding.file ?? prFiles[0]?.filename;
                    if (path) {
                        const line =
                            pathToFirstDiffLine[path] ?? finding.line ?? 1;
                        if (existing?.prCommentId != null && existing.prNumber === openPrNumbers[0]) {
                            await this.pullRequestRepository.updatePullRequestReviewComment(
                                owner,
                                repo,
                                existing.prCommentId,
                                commentBody,
                                token
                            );
                        } else {
                            prCommentsToCreate.push({ path, line, body: commentBody });
                        }
                    }
                }
            }

            if (prCommentsToCreate.length > 0 && prHeadSha && openPrNumbers.length > 0) {
                await this.pullRequestRepository.createReviewWithComments(
                    owner,
                    repo,
                    openPrNumbers[0],
                    prHeadSha,
                    prCommentsToCreate,
                    token
                );
            }

            const stepParts = [`${findings.length} new/current finding(s) from OpenCode`];
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
