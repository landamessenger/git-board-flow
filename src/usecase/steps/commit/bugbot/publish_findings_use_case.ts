import type { Execution } from "../../../../data/model/execution";
import { IssueRepository } from "../../../../data/repository/issue_repository";
import { PullRequestRepository } from "../../../../data/repository/pull_request_repository";
import { logDebugInfo } from "../../../../utils/logger";
import type { BugbotContext } from "./types";
import type { BugbotFinding } from "./types";
import { buildCommentBody } from "./marker";

export interface PublishFindingsParam {
    execution: Execution;
    context: BugbotContext;
    findings: BugbotFinding[];
    /** When findings were limited by max comments, add one summary comment with this overflow info. */
    overflowCount?: number;
    overflowTitles?: string[];
}

/**
 * Publishes current findings to issue and PR: creates or updates issue comments,
 * creates or updates PR review comments (or creates new ones).
 */
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

        if (prContext && openPrNumbers.length > 0) {
            const path = finding.file ?? prFiles[0]?.filename;
            if (path) {
                const line = pathToFirstDiffLine[path] ?? finding.line ?? 1;
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
