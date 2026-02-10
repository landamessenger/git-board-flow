import type { Execution } from "../../../../data/model/execution";
import { IssueRepository } from "../../../../data/repository/issue_repository";
import { PullRequestRepository } from "../../../../data/repository/pull_request_repository";
import type { BugbotContext, ExistingByFindingId } from "./types";
import { extractTitleFromBody, parseMarker } from "./marker";

/**
 * Loads all context needed for bugbot: existing findings from issue + PR comments,
 * open PR numbers, and the prompt block for previously reported issues.
 * Also loads PR context (head sha, files, diff lines) for the first open PR.
 */
export async function loadBugbotContext(param: Execution): Promise<BugbotContext> {
    const issueNumber = param.issueNumber;
    const headBranch = param.commit.branch;
    const token = param.tokens.token;
    const owner = param.owner;
    const repo = param.repo;

    const issueRepository = new IssueRepository();
    const pullRequestRepository = new PullRequestRepository();

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

    const openPrNumbers = await pullRequestRepository.getOpenPullRequestNumbersByHeadBranch(
        owner,
        repo,
        headBranch,
        token
    );

    for (const prNumber of openPrNumbers) {
        const prComments = await pullRequestRepository.listPullRequestReviewComments(
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

    const previousFindingsBlock =
        previousFindingsForPrompt.length > 0
            ? `
**Previously reported issues (from our comments, not yet marked resolved):**
${previousFindingsForPrompt.map((p) => `- id: "${p.id.replace(/"/g, '\\"')}" title: ${JSON.stringify(p.title)}`).join('\n')}

After analyzing the current code, return in \`resolved_finding_ids\` the ids of the above that are now fixed (the problem is no longer present). Only include ids from this list.`
            : '';

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
    };
}
