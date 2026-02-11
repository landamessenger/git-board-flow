/**
 * Publishes bugbot findings to the issue (and optionally to the PR as review comments).
 * For the issue: we always add or update a comment per finding (with marker).
 * For the PR: we only create a review comment when finding.file is in the PR's changed files list
 * (prContext.prFiles). We use pathToFirstDiffLine when finding has no line so the comment attaches
 * to a valid line in the diff. GitHub API requires (path, line) to exist in the PR diff.
 */

import type { Execution } from "../../../../data/model/execution";
import { IssueRepository } from "../../../../data/repository/issue_repository";
import { PullRequestRepository } from "../../../../data/repository/pull_request_repository";
import { logDebugInfo, logInfo } from "../../../../utils/logger";
import type { BugbotContext } from "./types";
import type { BugbotFinding } from "./types";
import { buildCommentBody } from "./marker";
import { resolveFindingPathForPr } from "./path_validation";

export interface PublishFindingsParam {
    execution: Execution;
    context: BugbotContext;
    findings: BugbotFinding[];
    /** When findings were limited by max comments, add one summary comment with this overflow info. */
    overflowCount?: number;
    overflowTitles?: string[];
}

/** Creates or updates issue comments for each finding; creates PR review comments only when finding.file is in prFiles. */
export async function publishFindings(param: PublishFindingsParam): Promise<void> {
    const { execution, context, findings, overflowCount = 0, overflowTitles = [] } = param;
    const { existingByFindingId, openPrNumbers, prContext } = context;
    const issueNumber = execution.issueNumber;
    const token = execution.tokens.token;
    const owner = execution.owner;
    const repo = execution.repo;

    const issueRepository = new IssueRepository();
    const pullRequestRepository = new PullRequestRepository();

    const prFiles = prContext?.prFiles ?? [];
    const pathToFirstDiffLine = prContext?.pathToFirstDiffLine ?? {};
    const prCommentsToCreate: Array<{ path: string; line: number; body: string }> = [];

    for (const finding of findings) {
        const existing = existingByFindingId[finding.id];
        const commentBody = buildCommentBody(finding, false);

        if (existing?.issueCommentId != null) {
            await issueRepository.updateComment(
                owner,
                repo,
                issueNumber,
                existing.issueCommentId,
                commentBody,
                token
            );
            logDebugInfo(`Updated bugbot comment for finding ${finding.id} on issue.`);
        } else {
            await issueRepository.addComment(owner, repo, issueNumber, commentBody, token);
            logDebugInfo(`Added bugbot comment for finding ${finding.id} on issue.`);
        }

        // PR review comment: only if this finding's file is in the PR changed files (so GitHub can attach the comment).
        if (prContext && openPrNumbers.length > 0) {
            const path = resolveFindingPathForPr(finding.file, prFiles);
            if (path) {
                const line = finding.line ?? pathToFirstDiffLine[path] ?? 1;
                if (existing?.prCommentId != null && existing.prNumber === openPrNumbers[0]) {
                    await pullRequestRepository.updatePullRequestReviewComment(
                        owner,
                        repo,
                        existing.prCommentId,
                        commentBody,
                        token
                    );
                } else {
                    prCommentsToCreate.push({ path, line, body: commentBody });
                }
            } else if (finding.file != null && String(finding.file).trim() !== "") {
                logInfo(
                    `Bugbot finding "${finding.id}" file "${finding.file}" not in PR changed files (${prFiles.length} files); skipping PR review comment.`
                );
            }
        }
    }

    if (prCommentsToCreate.length > 0 && prContext && openPrNumbers.length > 0) {
        await pullRequestRepository.createReviewWithComments(
            owner,
            repo,
            openPrNumbers[0],
            prContext.prHeadSha,
            prCommentsToCreate,
            token
        );
    }

    if (overflowCount > 0) {
        const titlesList =
            overflowTitles.length > 0
                ? '\n- ' + overflowTitles.slice(0, 15).join('\n- ') + (overflowTitles.length > 15 ? `\n- ... and ${overflowTitles.length - 15} more` : '')
                : '';
        const overflowBody = `## More findings (comment limit)

There are **${overflowCount}** more finding(s) that were not published as individual comments. Review locally or in the full diff to see the list.${titlesList}`;
        await issueRepository.addComment(owner, repo, issueNumber, overflowBody, token);
        logDebugInfo(`Added overflow comment: ${overflowCount} additional finding(s) not published individually.`);
    }
}
