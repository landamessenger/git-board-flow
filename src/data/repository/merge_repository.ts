import * as github from '@actions/github';
import { logDebugInfo, logError } from '../../utils/logger';
import { Result } from '../model/result';

/**
 * Repository for merging branches (via PR or direct merge).
 * Isolated to allow unit tests with mocked Octokit.
 */
export class MergeRepository {

    mergeBranch = async (
        owner: string,
        repository: string,
        head: string,
        base: string,
        timeout: number,
        token: string,
    ): Promise<Result[]> => {
        const result: Result[] = [];
        try {
            const octokit = github.getOctokit(token);
            logDebugInfo(`Creating merge from ${head} into ${base}`);

            // Build PR body with commit list
            const prBody = `🚀 Automated Merge  

This PR merges **${head}** into **${base}**.  

**Commits included:**`;

            // We need PAT for creating PR to ensure it can trigger workflows
            const { data: pullRequest } = await octokit.rest.pulls.create({
                owner: owner,
                repo: repository,
                head: head,
                base: base,
                title: `Merge ${head} into ${base}`,
                body: prBody,
            });

            logDebugInfo(`Pull request #${pullRequest.number} created, getting commits...`);

            // Get all commits in the PR
            const { data: commits } = await octokit.rest.pulls.listCommits({
                owner: owner,
                repo: repository,
                pull_number: pullRequest.number,
            });

            const commitMessages = commits.map(commit => commit.commit.message);

            logDebugInfo(`Found ${commitMessages.length} commits in PR`);

            // Update PR with commit list and footer
            await octokit.rest.pulls.update({
                owner: owner,
                repo: repository,
                pull_number: pullRequest.number,
                body: prBody + '\n' + commitMessages.map(msg => `- ${msg}`).join('\n') +
                    '\n\nThis PR was automatically created by [`copilot`](https://github.com/vypdev/copilot).',
            });

            const iteration = 10;
            if (timeout > iteration) {
                // Wait for checks to complete - can use regular token for reading checks
                let checksCompleted = false;
                let attempts = 0;
                const maxAttempts = timeout > iteration ? Math.floor(timeout / iteration) : iteration;

                while (!checksCompleted && attempts < maxAttempts) {
                    const { data: checkRuns } = await octokit.rest.checks.listForRef({
                        owner: owner,
                        repo: repository,
                        ref: head,
                    });

                    // Get commit status checks for the PR head commit
                    const { data: commitStatus } = await octokit.rest.repos.getCombinedStatusForRef({
                        owner: owner,
                        repo: repository,
                        ref: head,
                    });

                    logDebugInfo(`Combined status state: ${commitStatus.state}`);
                    logDebugInfo(`Number of check runs: ${checkRuns.check_runs.length}`);

                    // If there are check runs, prioritize those over status checks
                    if (checkRuns.check_runs.length > 0) {
                        const pendingCheckRuns = checkRuns.check_runs.filter(
                            check => check.status !== 'completed',
                        );

                        if (pendingCheckRuns.length === 0) {
                            checksCompleted = true;
                            logDebugInfo('All check runs have completed.');

                            // Verify if all checks passed
                            const failedChecks = checkRuns.check_runs.filter(
                                check => check.conclusion === 'failure',
                            );

                            if (failedChecks.length > 0) {
                                throw new Error(`Checks failed: ${failedChecks.map(check => check.name).join(', ')}`);
                            }
                        } else {
                            logDebugInfo(`Waiting for ${pendingCheckRuns.length} check runs to complete:`);
                            pendingCheckRuns.forEach(check => {
                                logDebugInfo(`  - ${check.name} (Status: ${check.status})`);
                            });
                            await new Promise(resolve => setTimeout(resolve, iteration * 1000));
                            attempts++;
                            continue;
                        }
                    } else {
                        // Fall back to status checks if no check runs exist
                        const pendingChecks = commitStatus.statuses.filter(status => {
                            logDebugInfo(`Status check: ${status.context} (State: ${status.state})`);
                            return status.state === 'pending';
                        });

                        if (pendingChecks.length === 0) {
                            checksCompleted = true;
                            logDebugInfo('All status checks have completed.');
                        } else {
                            logDebugInfo(`Waiting for ${pendingChecks.length} status checks to complete:`);
                            pendingChecks.forEach(check => {
                                logDebugInfo(`  - ${check.context} (State: ${check.state})`);
                            });
                            await new Promise(resolve => setTimeout(resolve, iteration * 1000));
                            attempts++;
                        }
                    }
                }

                if (!checksCompleted) {
                    throw new Error('Timed out waiting for checks to complete');
                }
            }

            // Need PAT for merging to ensure it can trigger subsequent workflows
            await octokit.rest.pulls.merge({
                owner: owner,
                repo: repository,
                pull_number: pullRequest.number,
                merge_method: 'merge',
                commit_title: `Merge ${head} into ${base}. Forced merge with PAT token.`,
            });

            result.push(
                new Result({
                    id: 'branch_repository',
                    success: true,
                    executed: true,
                    steps: [
                        `The branch \`${head}\` was merged into \`${base}\`.`,
                    ],
                }),
            );
        } catch (error) {
            logError(`Error in PR workflow: ${error}`);

            // If the PR workflow fails, we try to merge directly - need PAT for direct merge to ensure it can trigger workflows
            try {
                const octokit = github.getOctokit(token);
                await octokit.rest.repos.merge({
                    owner: owner,
                    repo: repository,
                    base: base,
                    head: head,
                    commit_message: `Forced merge of ${head} into ${base}. Automated merge with PAT token.`,
                });

                result.push(
                    new Result({
                        id: 'branch_repository',
                        success: true,
                        executed: true,
                        steps: [
                            `The branch \`${head}\` was merged into \`${base}\` using direct merge.`,
                        ],
                    }),
                );
                return result;
            } catch (directMergeError) {
                logError(`Error in direct merge attempt: ${directMergeError}`);
                result.push(
                    new Result({
                        id: 'branch_repository',
                        success: false,
                        executed: true,
                        steps: [
                            `Failed to merge branch \`${head}\` into \`${base}\`.`,
                        ],
                    }),
                );
                result.push(
                    new Result({
                        id: 'branch_repository',
                        success: false,
                        executed: true,
                        error: error,
                    }),
                );
                result.push(
                    new Result({
                        id: 'branch_repository',
                        success: false,
                        executed: true,
                        error: directMergeError,
                    }),
                );
            }
        }
        return result;
    };
}
