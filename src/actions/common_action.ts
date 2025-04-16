import * as core from '@actions/core';
import { Execution } from '../data/model/execution';
import { Result } from '../data/model/result';
import { CommitUseCase } from '../usecase/commit_use_case';
import { IssueCommentUseCase } from '../usecase/issue_comment_use_case';
import { IssueUseCase } from '../usecase/issue_use_case';
import { PullRequestReviewCommentUseCase } from '../usecase/pull_request_review_comment_use_case';
import { PullRequestUseCase } from '../usecase/pull_request_use_case';
import { SingleActionUseCase } from '../usecase/single_action_use_case';
import { logInfo } from '../utils/logger';

export async function mainRun(execution: Execution): Promise<Result[]> {
    await execution.setup();

    if (execution.runnedByToken) {
        logInfo(`User from token (${execution.tokenUser}) matches actor. Ignoring.`);
        return [];
    }

    if (execution.issueNumber === -1) {
        logInfo(`Issue number not found. Skipping.`);
        return [];
    }

    const results: Result[] = []

    try {
        if (execution.isSingleAction) {
            results.push(...await new SingleActionUseCase().invoke(execution));
        } else if (execution.isIssue) {
            if (execution.issue.isIssueComment) {
                results.push(...await new IssueCommentUseCase().invoke(execution));
            } else {
                results.push(...await new IssueUseCase().invoke(execution));
            }
        } else if (execution.isPullRequest) {
            if (execution.pullRequest.isPullRequestReviewComment) {
                results.push(...await new PullRequestReviewCommentUseCase().invoke(execution));
            } else {
                results.push(...await new PullRequestUseCase().invoke(execution));
            }
        } else if (execution.isPush) {
            results.push(...await new CommitUseCase().invoke(execution));
        } else {
            core.setFailed(`Action not handled.`);
        }

        return results;
    } catch (error: any) {
        core.setFailed(error.message);
        return [];
    }
}

