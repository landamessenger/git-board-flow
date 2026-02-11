import * as core from '@actions/core';
import { Execution } from '../data/model/execution';
import { Result } from '../data/model/result';
import { CommitUseCase } from '../usecase/commit_use_case';
import { IssueCommentUseCase } from '../usecase/issue_comment_use_case';
import { IssueUseCase } from '../usecase/issue_use_case';
import { PullRequestReviewCommentUseCase } from '../usecase/pull_request_review_comment_use_case';
import { PullRequestUseCase } from '../usecase/pull_request_use_case';
import { SingleActionUseCase } from '../usecase/single_action_use_case';
import { logError, logInfo } from '../utils/logger';
import { ACTIONS, TITLE } from '../utils/constants';
import chalk from 'chalk';
import boxen from 'boxen';
import { waitForPreviousRuns } from '../utils/queue_utils';
import { copySetupFiles, ensureGitHubDirs } from '../utils/setup_files';

export async function mainRun(execution: Execution): Promise<Result[]> {
    const results: Result[] = []
    
    await execution.setup();

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
            logInfo(`User from token (${execution.tokenUser}) matches actor. Executing single action.`);
            results.push(...await new SingleActionUseCase().invoke(execution));
            return results;
        }
        logInfo(`User from token (${execution.tokenUser}) matches actor. Ignoring.`);
        return results;
    }

    
    if (execution.issueNumber === -1) {
        if (execution.isSingleAction && execution.singleAction.isSingleActionWithoutIssue) {
            results.push(...await new SingleActionUseCase().invoke(execution));
        } else {
            logInfo(`Issue number not found. Skipping.`);
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
        if (execution.isSingleAction && execution.singleAction.currentSingleAction === ACTIONS.INITIAL_SETUP) {
            const cwd = process.cwd();
            logInfo('📁 Ensuring .github and .github/workflows exist...');
            ensureGitHubDirs(cwd);
            logInfo('📋 Copying setup files from setup/ to .github/ (skipping existing)...');
            const copied = copySetupFiles(cwd);
            if (copied > 0) {
                logInfo(`✅ Copied ${copied} file(s).`);
            } else {
                logInfo('ℹ️  No setup/ folder found or all files already exist; nothing to copy.');
            }
        }
    }

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
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        core.setFailed(msg);
        return [];
    }
}

