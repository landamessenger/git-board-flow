/**
 * Loads all bugbot context: existing findings from issue and PR comments (via marker parsing),
 * open PR numbers for the head branch, the formatted "previous findings" block for OpenCode,
 * and PR metadata (head sha, changed files, first diff line per file) used only when publishing
 * findings to GitHub — not sent to OpenCode.
 */

import type { Execution } from "../../../../data/model/execution";
import { IssueRepository } from "../../../../data/repository/issue_repository";
import { PullRequestRepository } from "../../../../data/repository/pull_request_repository";
import type { BugbotContext, ExistingByFindingId } from "./types";
import { MAX_FINDING_BODY_LENGTH, truncateFindingBody } from "./build_bugbot_fix_prompt";
import { parseMarker } from "./marker";
import { logDebugInfo } from "../../../../utils/logger";

/** Builds the text block sent to OpenCode for task 2 (decide which previous findings are now resolved). */
function buildPreviousFindingsBlock(previousFindings: Array<{ id: string; fullBody: string }>): string {
    if (previousFindings.length === 0) return '';
    const items = previousFindings
        .map(
            (p) =>
                `---\n**Finding id (use this exact id in resolved_finding_ids if resolved/no longer applies):** \`${p.id.replace(/`/g, '\\`')}\`\n\n**Full comment as posted (including metadata at the end):**\n${p.fullBody}\n`
        )
        .join('\n');
    return `
**Previously reported issues (not yet marked resolved).** For each one we show the exact comment we posted (title, description, location, suggestion, and a hidden marker with the finding id at the end).

${items}
**Your task 2:** For each finding above, analyze the current code and decide:
- If the problem **still exists** (same code or same issue present): do **not** include its id in \`resolved_finding_ids\`.
- If the problem **no longer applies** (e.g. that code was removed or refactored away): include its id in \`resolved_finding_ids\`.
- If the problem **has been fixed** (code was changed and the issue is resolved): include its id in \`resolved_finding_ids\`.

Return in \`resolved_finding_ids\` only the ids from the list above that are now fixed or no longer apply. Use the exact id shown in each "Finding id" line.`;
}

export interface LoadBugbotContextOptions {
    /** When set (e.g. for issue_comment when commit.branch is empty), use this branch to find open PRs. */
    branchOverride?: string;
}

/**
 * Loads all context needed for bugbot: existing findings from issue + PR comments,
 * open PR numbers, and the prompt block for previously reported issues.
 * Also loads PR context (head sha, files, diff lines) for the first open PR.
 */
export async function loadBugbotContext(
    param: Execution,
    options?: LoadBugbotContextOptions
): Promise<BugbotContext> {
    const issueNumber = param.issueNumber;
    const headBranch = (options?.branchOverride ?? param.commit.branch)?.trim();
    const token = param.tokens.token;
    const owner = param.owner;
    const repo = param.repo;

    if (!headBranch) {
        logDebugInfo('LoadBugbotContext: no head branch (branchOverride or commit.branch); returning empty context.');
        return {
            existingByFindingId: {},
            issueComments: [],
            openPrNumbers: [],
            previousFindingsBlock: "",
            prContext: null,
            unresolvedFindingsWithBody: [],
        };
    }

    const issueRepository = new IssueRepository();
    const pullRequestRepository = new PullRequestRepository();

    // Parse issue comments for bugbot markers to know which findings we already posted and if resolved.
    const issueComments = await issueRepository.listIssueComments(owner, repo, issueNumber, token);
    const existingByFindingId: ExistingByFindingId = {};
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
    // Truncate issue comment bodies so we don't hold huge strings in memory (used later for previousFindingsForPrompt).
    for (const c of issueComments) {
        if (c.body != null && c.body.length > MAX_FINDING_BODY_LENGTH) {
            c.body = truncateFindingBody(c.body, MAX_FINDING_BODY_LENGTH);
        }
    }

    const openPrNumbers = await pullRequestRepository.getOpenPullRequestNumbersByHeadBranch(
        owner,
        repo,
        headBranch,
        token
    );

    // Also collect findings from PR review comments (same marker format).
    /** Full comment body per finding id (from PR when we don't have issue comment). */
    const prFindingIdToBody: Record<string, string> = {};
    for (const prNumber of openPrNumbers) {
        const prComments = await pullRequestRepository.listPullRequestReviewComments(
            owner,
            repo,
            prNumber,
            token
        );
        for (const c of prComments) {
            const body = c.body ?? "";
            const bodyBounded = truncateFindingBody(body, MAX_FINDING_BODY_LENGTH);
            for (const { findingId, resolved } of parseMarker(body)) {
                if (!existingByFindingId[findingId]) {
                    existingByFindingId[findingId] = { resolved };
                }
                existingByFindingId[findingId].prCommentId = c.id;
                existingByFindingId[findingId].prNumber = prNumber;
                existingByFindingId[findingId].resolved = resolved;
                prFindingIdToBody[findingId] = bodyBounded;
            }
        }
    }

    /** Unresolved findings with full comment body (including hidden marker) for OpenCode to re-evaluate. */
    const previousFindingsForPrompt: Array<{ id: string; fullBody: string }> = [];
    for (const [findingId, data] of Object.entries(existingByFindingId)) {
        if (data.resolved) continue;
        const issueBody = issueComments.find((c) => c.id === data.issueCommentId)?.body ?? null;
        const rawBody = (issueBody ?? prFindingIdToBody[findingId] ?? "").trim();
        if (rawBody) {
            const fullBody = truncateFindingBody(rawBody, MAX_FINDING_BODY_LENGTH);
            previousFindingsForPrompt.push({ id: findingId, fullBody });
        }
    }

    const previousFindingsBlock = buildPreviousFindingsBlock(previousFindingsForPrompt);

    const unresolvedFindingsWithBody: BugbotContext['unresolvedFindingsWithBody'] =
        previousFindingsForPrompt.map((p) => ({ id: p.id, fullBody: p.fullBody }));

    logDebugInfo(`LoadBugbotContext: issue #${issueNumber}, branch ${headBranch}, open PRs=${openPrNumbers.length}, existing findings=${Object.keys(existingByFindingId).length}, unresolved with body=${unresolvedFindingsWithBody.length}.`);

    // PR context is only for publishing: we need file list and diff lines so GitHub review comments attach to valid (path, line).
    let prContext: BugbotContext['prContext'] = null;
    if (openPrNumbers.length > 0) {
        const prHeadSha = await pullRequestRepository.getPullRequestHeadSha(
            owner,
            repo,
            openPrNumbers[0],
            token
        );
        if (prHeadSha) {
            const prFiles = await pullRequestRepository.getChangedFiles(
                owner,
                repo,
                openPrNumbers[0],
                token
            );
            const filesWithLines = await pullRequestRepository.getFilesWithFirstDiffLine(
                owner,
                repo,
                openPrNumbers[0],
                token
            );
            const pathToFirstDiffLine: Record<string, number> = {};
            for (const { path, firstLine } of filesWithLines) {
                pathToFirstDiffLine[path] = firstLine;
            }
            prContext = { prHeadSha, prFiles, pathToFirstDiffLine };
        }
    }

    return {
        existingByFindingId,
        issueComments,
        openPrNumbers,
        previousFindingsBlock,
        prContext,
        unresolvedFindingsWithBody,
    };
}
