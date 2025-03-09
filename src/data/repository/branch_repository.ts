import * as exec from '@actions/exec';
import * as core from '@actions/core';
import * as github from "@actions/github";
import {Result} from "../model/result";
import {Execution} from "../model/execution";
import {getLatestVersion} from "../utils/version_utils";

export class BranchRepository {

    fetchRemoteBranches = async () => {
        try {
            core.info('Fetching tags and forcing fetch...');
            await exec.exec('git', ['fetch', '--tags', '--force']);

            core.info('Fetching all remote branches with verbose output...');
            await exec.exec('git', ['fetch', '--all', '-v']);

            core.info('Successfully fetched all remote branches.');
        } catch (error) {
            core.setFailed(`Error fetching remote branches: ${error}`);
        }
    }

    getLatestTag = async () => {
        try {
            core.info('Fetching the latest tag...');
            await exec.exec('git', ['fetch', '--tags']);

            const tags: string[] = [];
            await exec.exec('git', ['tag', '--sort=-creatordate'], {
                listeners: {
                    stdout: (data: Buffer) => {
                        tags.push(...data.toString().split('\n').map((v, i, a) => {
                            return v.replace('v', '')
                        }));
                    },
                },
            });

            const validTags = tags.filter(tag => /\d+\.\d+\.\d+$/.test(tag));

            if (validTags.length > 0) {
                const latestTag = getLatestVersion(validTags);
                core.info(`Latest tag: ${latestTag}`);
                return latestTag;
            } else {
                core.info('No valid tags found.');
                return undefined;
            }
        } catch (error) {
            core.setFailed(`Error fetching the latest tag: ${error}`);
            return undefined
        }
    }

    getCommitTag = async (latestTag: string | undefined) => {
        try {
            if (!latestTag) {
                core.setFailed('No LATEST_TAG found in the environment');
                return;
            }

            let tagVersion: string
            if (latestTag.startsWith('v')) {
                tagVersion = latestTag;
            } else {
                tagVersion = `v${latestTag}`;
            }

            core.info(`Fetching commit hash for the tag: ${tagVersion}`);
            let commitOid = '';
            await exec.exec('git', ['rev-list', '-n', '1', tagVersion], {
                listeners: {
                    stdout: (data: Buffer) => {
                        commitOid = data.toString().trim();
                    },
                },
            });

            if (commitOid) {
                core.info(`Commit tag: ${commitOid}`);
                return commitOid;
            } else {
                core.setFailed('No commit found for the tag');
            }
        } catch (error) {
            core.setFailed(`Error fetching the commit hash: ${error}`);
        }
        return undefined
    }

    /**
     * Returns replaced branch (if any).
     *
     * @param param
     * @param repository
     * @param owner
     * @param token
     * @param issueNumber
     * @param issueTitle
     * @param branchType
     * @param developmentBranch
     * @param hotfixBranch
     * @param isHotfix
     */
    manageBranches = async (
        param: Execution,
        owner: string,
        repository: string,
        issueNumber: number,
        issueTitle: string,
        branchType: string,
        developmentBranch: string,
        hotfixBranch: string | undefined,
        isHotfix: boolean,
        token: string,
    ): Promise<Result[]> => {
        const result: Result[] = []
        try {
            core.info(`Managing branches`);

            const branches = await this.getListOfBranches(owner, repository, token)
            console.log(JSON.stringify(branches, null, 2));

            if (hotfixBranch === undefined && isHotfix) {
                result.push(
                    new Result({
                        id: 'branch_repository',
                        success: false,
                        executed: true,
                        steps: [
                            `Tried to prepare the hotfix branch of the issue, but hotfix branch was not found.`,
                        ],
                    })
                )
                return result
            }

            const octokit = github.getOctokit(token);

            const sanitizedTitle = this.formatBranchName(issueTitle, issueNumber);

            const newBranchName = `${branchType}/${issueNumber}-${sanitizedTitle}`;
            if (branches.indexOf(newBranchName) > -1) {
                result.push(
                    new Result({
                        id: 'branch_repository',
                        success: true,
                        executed: false,
                    })
                )
                return result
            }

            const branchTypes = [param.branches.featureTree, param.branches.bugfixTree];

            /**
             * Default base branch name. (ex. [develop])
             */
            let baseBranchName = developmentBranch;

            if (!isHotfix) {
                /**
                 * Check if it is a branch switch: feature/123-bla <-> bugfix/123-bla
                 */
                core.info(`Searching for branches related to issue #${issueNumber}...`);

                const {data} = await octokit.rest.repos.listBranches({
                    owner: owner,
                    repo: repository,
                });

                for (const type of branchTypes) {
                    const prefix = `${type}/${issueNumber}-`;

                    try {
                        const matchingBranch = data.find(branch => branch.name.indexOf(prefix) > -1);

                        if (matchingBranch) {
                            baseBranchName = matchingBranch.name;
                            core.info(`Found previous issue branch: ${baseBranchName}`);
                            // TODO replacedBranchName = baseBranchName
                            break;
                        }
                    } catch (error) {
                        core.error(`Error while listing branches: ${error}`);
                        result.push(
                            new Result({
                                id: 'branch_repository',
                                success: false,
                                executed: true,
                                steps: [
                                    `Error while listing branches.`,
                                ],
                                error: error,
                            })
                        )
                    }
                }
            } else {
                baseBranchName = hotfixBranch ?? developmentBranch;
            }

            core.info(`============================================================================================`);
            core.info(`Base branch: ${baseBranchName}`);
            core.info(`New branch: ${newBranchName}`);

            result.push(
                ...await this.createLinkedBranch(
                    owner,
                    repository,
                    baseBranchName,
                    newBranchName,
                    issueNumber,
                    undefined,
                    token
                )
            )
        } catch (error) {
            console.error(error);
            result.push(
                new Result({
                    id: 'branch_repository',
                    success: false,
                    executed: true,
                    steps: [
                        `Tried to prepare the hotfix to the issue, but there was a problem.`,
                    ],
                    error: error,
                })
            )
        }
        return result
    }

    formatBranchName = (issueTitle: string, issueNumber: number): string => {
        let sanitizedTitle = issueTitle.toLowerCase()
            .replace(/\b\d+(\.\d+){2,}\b/g, '')
            .replace(/[^\p{L}\p{N}\p{P}\p{Z}^$\n]/gu, '')
            .replace(/\u200D/g, '')
            .replace(/[^\S\r\n]+/g, ' ')
            .replace(/[^a-zA-Z0-9 .]/g, '')
            .replace(/^-+|-+$/g, '')
            .replace(/- -/g, '-').trim()
            .replace(/-+/g, '-')
            .trim();

        sanitizedTitle = sanitizedTitle.replace(/[^a-z0-9 ]/g, '').replace(/ /g, '-');

        const issuePrefix = `${issueNumber}-`;
        if (sanitizedTitle.startsWith(issuePrefix)) {
            sanitizedTitle = sanitizedTitle.substring(issuePrefix.length);
        }

        sanitizedTitle = sanitizedTitle.replace(/-+/g, '-');

        sanitizedTitle = sanitizedTitle.replace(/^-|-$/g, '');

        return sanitizedTitle;
    }

    createLinkedBranch = async (
        owner: string,
        repo: string,
        baseBranchName: string,
        newBranchName: string,
        issueNumber: number,
        oid: string | undefined,
        token: string,
    ): Promise<Result[]> => {
        const result: Result[] = []
        try {
            core.info(`Creating linked branch ${newBranchName} from ${oid ?? baseBranchName}`)

            let ref = `heads/${baseBranchName}`
            if (baseBranchName.indexOf('tags/') > -1) {
                ref = baseBranchName
            }

            const octokit = github.getOctokit(token);
            const {repository} = await octokit.graphql<RepositoryResponse>(`
              query($repo: String!, $owner: String!, $issueNumber: Int!) {
                repository(name: $repo, owner: $owner) {
                  id
                  issue(number: $issueNumber) {
                    id
                  }
                  ref(qualifiedName: "refs/${ref}") {
                    target {
                      ... on Commit {
                        oid
                      }
                    }
                  }
                }
              }
            `, {
                repo: repo,
                owner: owner,
                issueNumber: issueNumber
            });

            core.info(`Repository information retrieved: ${JSON.stringify(repository?.ref)}`)

            const repositoryId: string | undefined = repository?.id ?? undefined;
            const issueId: string | undefined = repository?.issue?.id ?? undefined;
            const branchOid: string | undefined = oid ?? repository?.ref?.target?.oid ?? undefined;

            if (repositoryId === undefined || issueNumber === undefined || branchOid === undefined) {
                core.error(`Error searching repository "${baseBranchName}": id: ${repositoryId}, oid: ${branchOid}), issue #${issueNumber}`);
                result.push(
                    new Result({
                        id: 'branch_repository',
                        success: false,
                        executed: true,
                        steps: [
                            `Error linking branch ${newBranchName} to issue: Repository not found.`,
                        ],
                    })
                )
                return result;
            }

            core.info(`Linking branch "${newBranchName}" (oid: ${branchOid}) to issue #${issueNumber}`);

            const mutationResponse = await octokit.graphql<LinkedBranchResponse>(`
                mutation($issueId: ID!, $name: String!, $repositoryId: ID!, $oid: GitObjectID!) {
                  createLinkedBranch(input: {
                    issueId: $issueId,
                    name: $name,
                    repositoryId: $repositoryId,
                    oid: $oid,
                  }) {
                    linkedBranch {
                      id
                      ref {
                        name
                      }
                    }
                  }
                }
              `, {
                issueId: issueId,
                name: `/${newBranchName}`,
                repositoryId: repositoryId,
                oid: branchOid,
            });

            core.info(`Linked branch: ${JSON.stringify(mutationResponse.createLinkedBranch?.linkedBranch)}`);

            const baseBranchUrl = `https://github.com/${owner}/${repo}/tree/${baseBranchName}`;
            const newBranchUrl = `https://github.com/${owner}/${repo}/tree/${newBranchName}`;
            result.push(
                new Result({
                    id: 'branch_repository',
                    success: true,
                    executed: true,
                    payload: {
                        baseBranchName: baseBranchName,
                        baseBranchUrl: baseBranchUrl,
                        newBranchName: newBranchName,
                        newBranchUrl: newBranchUrl,
                    },
                })
            )
        } catch (error) {
            core.error(`Error Linking branch "${error}"`);
            result.push(
                new Result({
                    id: 'branch_repository',
                    success: false,
                    executed: true,
                    steps: [
                        `Tried to link branch to the issue, but there was a problem.`,
                    ],
                    error: error,
                })
            )
        }
        return result;
    }

    removeBranch = async (
        owner: string,
        repository: string,
        branch: string,
        token: string,
    ): Promise<boolean> => {
        const octokit = github.getOctokit(token);

        const ref = `heads/${branch}`;

        try {
            const {data} = await octokit.rest.git.getRef({
                owner: owner,
                repo: repository,
                ref,
            });

            core.info(`Branch found: ${data.ref}`);

            await octokit.rest.git.deleteRef({
                owner: owner,
                repo: repository,
                ref,
            });

            core.info(`Successfully deleted branch: ${branch}`);

            return true;
        } catch (error) {
            core.error(`Error processing branch ${branch}: ${error}`);
            throw error;
        }
    }

    getListOfBranches = async (
        owner: string,
        repository: string,
        token: string
    ): Promise<string[]> => {
        const octokit = github.getOctokit(token);
        const {data} = await octokit.rest.repos.listBranches({
            owner: owner,
            repo: repository,
        });
        return data.map(branch => branch.name);
    }

    executeWorkflow = async (
        owner: string,
        repository: string,
        branch: string,
        workflow: string,
        inputs: any,
        token: string,
    ) => {
        const octokit = github.getOctokit(token);
        return octokit.rest.actions.createWorkflowDispatch({
            owner: owner,
            repo: repository,
            workflow_id: workflow,
            ref: branch,
            inputs: inputs
        });
    }

    mergeBranch = async (
        owner: string,
        repository: string,
        head: string,
        base: string,
        timeout: number,
        token: string,
        tokenPAT: string,
    ): Promise<Result[]> => {
        const result: Result[] = [];
        try {
            const octokit = github.getOctokit(token);
            const octokitPAT = github.getOctokit(tokenPAT);
            core.info(`Creating merge from ${head} into ${base}`);
            
            // Build PR body with commit list
            const prBody = `🚀 Automated Merge  

This PR merges **${head}** into **${base}**.  

**Commits included:**`;

            // We need PAT for creating PR to ensure it can trigger workflows
            const { data: pullRequest } = await octokitPAT.rest.pulls.create({
                owner: owner,
                repo: repository,
                head: head,
                base: base,
                title: `Merge ${head} into ${base}`,
                body: prBody,
            });

            core.info(`Pull request #${pullRequest.number} created, getting commits...`);

            // Get all commits in the PR
            const { data: commits } = await octokitPAT.rest.pulls.listCommits({
                owner: owner,
                repo: repository,
                pull_number: pullRequest.number
            });

            const commitMessages = commits.map(commit => commit.commit.message);
            
            core.info(`Found ${commitMessages.length} commits in PR`);

            // Update PR with commit list and footer
            await octokitPAT.rest.pulls.update({
                owner: owner,
                repo: repository,
                pull_number: pullRequest.number,
                body: prBody + '\n' + commitMessages.map(msg => `- ${msg}`).join('\n') +
                    '\n\nThis PR was automatically created by [`git-board-flow`](https://github.com/landamessenger/git-board-flow).'
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
                        ref: head
                    });

                    core.info(`Combined status state: ${commitStatus.state}`);
                    core.info(`Number of check runs: ${checkRuns.check_runs.length}`);

                    // If there are check runs, prioritize those over status checks
                    if (checkRuns.check_runs.length > 0) {
                        const pendingCheckRuns = checkRuns.check_runs.filter(
                            check => check.status !== 'completed'
                        );

                        if (pendingCheckRuns.length === 0) {
                            checksCompleted = true;
                            core.info('All check runs have completed.');

                            // Verify if all checks passed
                            const failedChecks = checkRuns.check_runs.filter(
                                check => check.conclusion === 'failure'
                            );

                            if (failedChecks.length > 0) {
                                throw new Error(`Checks failed: ${failedChecks.map(check => check.name).join(', ')}`);
                            }
                        } else {
                            core.info(`Waiting for ${pendingCheckRuns.length} check runs to complete:`);
                            pendingCheckRuns.forEach(check => {
                                core.info(`  - ${check.name} (Status: ${check.status})`);
                            });
                            await new Promise(resolve => setTimeout(resolve, iteration * 1000));
                            attempts++;
                            continue;
                        }
                    } else {
                        // Fall back to status checks if no check runs exist
                        if (commitStatus.state === 'pending') {
                            core.info('Combined status is still pending');
                            await new Promise(resolve => setTimeout(resolve, iteration * 1000));
                            attempts++;
                            continue;
                        }

                        // Filter for pending status checks
                        const pendingChecks = commitStatus.statuses.filter(status => {
                            core.info(`Status check: ${status.context} (State: ${status.state})`);
                            return status.state === 'pending';
                        });

                        if (pendingChecks.length === 0) {
                            checksCompleted = true;
                            core.info('All status checks have completed.');
                        } else {
                            core.info(`Waiting for ${pendingChecks.length} status checks to complete:`);
                            pendingChecks.forEach(check => {
                                core.info(`  - ${check.context} (State: ${check.state})`);
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
            await octokitPAT.rest.pulls.merge({
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
                })
            );
        } catch (error) {
            core.error(`Error in PR workflow: ${error}`);
            
            // If the PR workflow fails, we try to merge directly - need PAT for direct merge to ensure it can trigger workflows
            try {
                const octokitPAT = github.getOctokit(tokenPAT);
                await octokitPAT.rest.repos.merge({
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
                    })
                );
                return result;
            } catch (directMergeError) {
                core.error(`Error in direct merge attempt: ${directMergeError}`);
                result.push(
                    new Result({
                        id: 'branch_repository',
                        success: false,
                        executed: true,
                        steps: [
                            `Failed to merge branch \`${head}\` into \`${base}\`.`,
                            `PR workflow failed: ${error}`,
                            `Direct merge failed: ${directMergeError}`,
                        ],
                        error: directMergeError,
                    })
                );
            }
        }
        return result;
    }

}