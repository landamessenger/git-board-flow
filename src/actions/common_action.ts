import * as core from '@actions/core';
import { Execution } from '../data/model/execution';
import { Result } from '../data/model/result';
import { CommitUseCase } from '../usecase/commit_use_case';
import { IssueCommentUseCase } from '../usecase/issue_comment_use_case';
import { IssueUseCase } from '../usecase/issue_use_case';
import { PullRequestReviewCommentUseCase } from '../usecase/pull_request_review_comment_use_case';
import { PullRequestUseCase } from '../usecase/pull_request_use_case';
import { SingleActionUseCase } from '../usecase/single_action_use_case';
import { clearAccumulatedLogs, logDebugInfo, logError, logInfo } from '../utils/logger';
import { TITLE } from '../utils/constants';
import chalk from 'chalk';
import boxen from 'boxen';
import { waitForPreviousRuns } from '../utils/queue_utils';

export async function mainRun(execution: Execution): Promise<Result[]> {
    const results: Result[] = [];

    logInfo('GitHub Action: starting main run.');
    logDebugInfo(`Event: ${execution.eventName}, actor: ${execution.actor}, repo: ${execution.owner}/${execution.repo}, debug: ${execution.debug}`);

    await execution.setup();
    clearAccumulatedLogs();

    logDebugInfo(`Setup done. Issue number: ${execution.issueNumber}, isSingleAction: ${execution.isSingleAction}, isIssue: ${execution.isIssue}, isPullRequest: ${execution.isPullRequest}, isPush: ${execution.isPush}`);

    if (!execution.welcome) {
        /**
         * Wait for previous runs to finish
         */
        await waitForPreviousRuns(execution).catch((err) => {
            logError(`Error waiting for previous runs: ${err}`);
            process.exit(1);
        });
    }
    
    if (execution.runnedByToken) {
        if (execution.isSingleAction && execution.singleAction.validSingleAction) {
            logInfo(`User from token (${execution.tokenUser}) matches actor. Executing single action: ${execution.singleAction.currentSingleAction}.`);
            results.push(...await new SingleActionUseCase().invoke(execution));
            logInfo(`Single action finished. Results: ${results.length}.`);
            return results;
        }
        logInfo(`User from token (${execution.tokenUser}) matches actor. Ignoring (not a valid single action).`);
        return results;
    }

    if (execution.issueNumber === -1) {
        if (execution.isSingleAction && execution.singleAction.isSingleActionWithoutIssue) {
            logInfo('No issue number; running single action without issue.');
            results.push(...await new SingleActionUseCase().invoke(execution));
        } else {
            logInfo('Issue number not found. Skipping.');
        }
        return results;
    }

    if (execution.welcome) {
        logInfo(
            boxen(
                chalk.cyan(execution.welcome.title) + '\n' +
                execution.welcome.messages.map(message => chalk.gray(message)).join('\n'),
                {
                    padding: 1,
                    margin: 1,
                    borderStyle: 'round',
                    borderColor: 'cyan',
                    title: TITLE,
                    titleAlignment: 'center'
                }
            )
        );
    }

    try {
        if (execution.isSingleAction) {
            logInfo(`Running SingleActionUseCase (action: ${execution.singleAction.currentSingleAction}).`);
            results.push(...await new SingleActionUseCase().invoke(execution));
        } else if (execution.isIssue) {
            if (execution.issue.isIssueComment) {
                logInfo(`Running IssueCommentUseCase for issue #${execution.issue.number}.`);
                results.push(...await new IssueCommentUseCase().invoke(execution));
            } else {
                logInfo(`Running IssueUseCase for issue #${execution.issueNumber}.`);
                results.push(...await new IssueUseCase().invoke(execution));
            }
        } else if (execution.isPullRequest) {
            if (execution.pullRequest.isPullRequestReviewComment) {
                logInfo(`Running PullRequestReviewCommentUseCase for PR #${execution.pullRequest.number}.`);
                results.push(...await new PullRequestReviewCommentUseCase().invoke(execution));
            } else {
                logInfo(`Running PullRequestUseCase for PR #${execution.pullRequest.number}.`);
                results.push(...await new PullRequestUseCase().invoke(execution));
            }
        } else if (execution.isPush) {
            logDebugInfo(`Push event. Branch: ${execution.commit?.branch ?? 'unknown'}, commits: ${execution.commit?.commits?.length ?? 0}, issue number: ${execution.issueNumber}.`);
            logInfo('Running CommitUseCase.');
            results.push(...await new CommitUseCase().invoke(execution));
        } else {
            logError(`Action not handled. Event: ${execution.eventName}.`);
            core.setFailed(`Action not handled.`);
        }

        const totalSteps = results.reduce((acc, r) => acc + (r.steps?.length ?? 0), 0);
        logInfo(`Main run finished. Results: ${results.length}, total steps: ${totalSteps}.`);
        return results;
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        logError(`Main run failed: ${msg}`, error instanceof Error ? { stack: (error as Error).stack } : undefined);
        core.setFailed(msg);
        return [];
    }
}

