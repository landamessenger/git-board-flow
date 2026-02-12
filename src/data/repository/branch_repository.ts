import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as github from "@actions/github";
import { logDebugInfo, logError } from '../../utils/logger';
import { getLatestVersion } from "../../utils/version_utils";
import { LinkedBranchResponse } from '../graph/linked_branch_response';
import { RepositoryResponse } from '../graph/repository_response';
import { Execution } from "../model/execution";
import { Labels } from '../model/labels';
import { Result } from "../model/result";
import { SizeThresholds } from '../model/size_thresholds';

export class BranchRepository {

    fetchRemoteBranches = async () => {
        try {
            logDebugInfo('Fetching tags and forcing fetch...');
            await exec.exec('git', ['fetch', '--tags', '--force']);

            logDebugInfo('Fetching all remote branches with verbose output...');
            await exec.exec('git', ['fetch', '--all', '-v']);

            logDebugInfo('Successfully fetched all remote branches.');
        } catch (error) {
            core.setFailed(`Error fetching remote branches: ${error}`);
        }
    }

    getLatestTag = async () => {
        try {
            logDebugInfo('Fetching the latest tag...');
            await exec.exec('git', ['fetch', '--tags']);

            const tags: string[] = [];
            await exec.exec('git', ['tag', '--sort=-creatordate'], {
                listeners: {
                    stdout: (data: Buffer) => {
                        tags.push(...data.toString().split('\n').map((v) => {
                            return v.replace('v', '')
                        }));
                    },
                },
            });

            const validTags = tags.filter(tag => /\d+\.\d+\.\d+$/.test(tag));

            if (validTags.length > 0) {
                const latestTag = getLatestVersion(validTags);
                logDebugInfo(`Latest tag: ${latestTag}`);
                return latestTag;
            } else {
                logDebugInfo('No valid tags found.');
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

            logDebugInfo(`Fetching commit hash for the tag: ${tagVersion}`);
            let commitOid = '';
            await exec.exec('git', ['rev-list', '-n', '1', tagVersion], {
                listeners: {
                    stdout: (data: Buffer) => {
                        commitOid = data.toString().trim();
                    },
                },
            });

            if (commitOid) {
                logDebugInfo(`Commit tag: ${commitOid}`);
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
            logDebugInfo(`Managing branches`);

            const branches = await this.getListOfBranches(owner, repository, token)
            logDebugInfo(JSON.stringify(branches, null, 2));

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
                );
                return result;
            }

            const branchTypes = [
                param.branches.featureTree,
                param.branches.bugfixTree,
                param.branches.docsTree,
                param.branches.choreTree,
            ];

            /**
             * Default base branch name. (ex. [develop])
             */
            let baseBranchName = developmentBranch;

            let isRenamingBranch = false;
            if (!isHotfix) {
                /**
                 * Check if it is a branch switch: feature/123-bla <-> bugfix/123-bla
                 */
                logDebugInfo(`Searching for branches related to issue #${issueNumber}...`);

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
                            isRenamingBranch = true;
                            logDebugInfo(`Found previous issue branch: ${baseBranchName}`);
                            // TODO replacedBranchName = baseBranchName
                            break;
                        }
                    } catch (error) {
                        logError(`Error while listing branches: ${error}`);
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

            if (!isRenamingBranch || param.currentConfiguration.parentBranch === undefined) {
                param.currentConfiguration.parentBranch = baseBranchName;
            }

            logDebugInfo(`============================================================================================`);
            logDebugInfo(`Base branch: ${baseBranchName}`);
            logDebugInfo(`New branch: ${newBranchName}`);

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
            logError(error);
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
            logDebugInfo(`Creating linked branch ${newBranchName} from ${oid ?? baseBranchName}`)

            let ref = `heads/${baseBranchName}`;
            if (baseBranchName.indexOf('tags/') > -1) {
                ref = baseBranchName;
            }
            const refForGraphQL = ref.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

            const octokit = github.getOctokit(token);
            const {repository} = await octokit.graphql<RepositoryResponse>(`
              query($repo: String!, $owner: String!, $issueNumber: Int!) {
                repository(name: $repo, owner: $owner) {
                  id
                  issue(number: $issueNumber) {
                    id
                  }
                  ref(qualifiedName: "refs/${refForGraphQL}") {
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

            logDebugInfo(`Repository information retrieved: ${JSON.stringify(repository?.ref)}`)

            const repositoryId: string | undefined = repository?.id ?? undefined;
            const issueId: string | undefined = repository?.issue?.id ?? undefined;
            const branchOid: string | undefined = oid ?? repository?.ref?.target?.oid ?? undefined;

            if (repositoryId === undefined || issueNumber === undefined || branchOid === undefined) {
                logError(`Error searching repository "${baseBranchName}": id: ${repositoryId}, oid: ${branchOid}), issue #${issueNumber}`);
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

            logDebugInfo(`Linking branch "${newBranchName}" (oid: ${branchOid}) to issue #${issueNumber}`);

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

            logDebugInfo(`Linked branch: ${JSON.stringify(mutationResponse.createLinkedBranch?.linkedBranch)}`);

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
            logError(`Error Linking branch "${error}"`);
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

            logDebugInfo(`Branch found: ${data.ref}`);

            await octokit.rest.git.deleteRef({
                owner: owner,
                repo: repository,
                ref,
            });

            logDebugInfo(`Successfully deleted branch: ${branch}`);

            return true;
        } catch (error) {
            logError(`Error processing branch ${branch}: ${error}`);
            throw error;
        }
    }

    getListOfBranches = async (
        owner: string,
        repository: string,
        token: string
    ): Promise<string[]> => {
        const octokit = github.getOctokit(token);
        const allBranches = [];
        let page = 1;
        
        while (true) {
            const {data} = await octokit.rest.repos.listBranches({
                owner: owner,
                repo: repository,
                per_page: 100,
                page: page,
            });
            
            if (data.length === 0) {
                break;
            }
            
            allBranches.push(...data.map(branch => branch.name));
            page++;
        }
        
        return allBranches;
    }

    executeWorkflow = async (
        owner: string,
        repository: string,
        branch: string,
        workflow: string,
        inputs: Record<string, unknown>,
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
                pull_number: pullRequest.number
            });

            const commitMessages = commits.map(commit => commit.commit.message);
            
            logDebugInfo(`Found ${commitMessages.length} commits in PR`);

            // Update PR with commit list and footer
            await octokit.rest.pulls.update({
                owner: owner,
                repo: repository,
                pull_number: pullRequest.number,
                body: prBody + '\n' + commitMessages.map(msg => `- ${msg}`).join('\n') +
                    '\n\nThis PR was automatically created by [`copilot`](https://github.com/vypdev/copilot).'
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

                    logDebugInfo(`Combined status state: ${commitStatus.state}`);
                    logDebugInfo(`Number of check runs: ${checkRuns.check_runs.length}`);

                    // If there are check runs, prioritize those over status checks
                    if (checkRuns.check_runs.length > 0) {
                        const pendingCheckRuns = checkRuns.check_runs.filter(
                            check => check.status !== 'completed'
                        );

                        if (pendingCheckRuns.length === 0) {
                            checksCompleted = true;
                            logDebugInfo('All check runs have completed.');

                            // Verify if all checks passed
                            const failedChecks = checkRuns.check_runs.filter(
                                check => check.conclusion === 'failure'
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
                })
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
                    })
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
                    })
                );
                result.push(
                    new Result({
                        id: 'branch_repository',
                        success: false,
                        executed: true,
                        error: error,
                    })
                );
                result.push(
                    new Result({
                        id: 'branch_repository',
                        success: false,
                        executed: true,
                        error: directMergeError,
                    })
                );
            }
        }
        return result;
    }

    getChanges = async (
        owner: string,
        repository: string,
        head: string,
        base: string,
        token: string,
    ) => {  
        const octokit = github.getOctokit(token);

        try {
            logDebugInfo(`Comparing branches: ${head} with ${base}`);
            
            let headRef = `heads/${head}`
            if (head.indexOf('tags/') > -1) {
                headRef = head
            }

            let baseRef = `heads/${base}`
            if (base.indexOf('tags/') > -1) {
                baseRef = base
            }

            const { data: comparison } = await octokit.rest.repos.compareCommits({
                owner: owner,
                repo: repository,
                base: baseRef,
                head: headRef,
            });

            return {
                aheadBy: comparison.ahead_by,
                behindBy: comparison.behind_by,
                totalCommits: comparison.total_commits,
                files: (comparison.files || []).map(file => ({
                    filename: file.filename,
                    status: file.status,
                    additions: file.additions,
                    deletions: file.deletions,
                    changes: file.changes,
                    blobUrl: file.blob_url,
                    rawUrl: file.raw_url,
                    contentsUrl: file.contents_url,
                    patch: file.patch
                })),
                commits: comparison.commits.map(commit => ({
                    sha: commit.sha,
                    message: commit.commit.message,
                    author: commit.commit.author || { name: 'Unknown', email: 'unknown@example.com', date: new Date().toISOString() },
                    date: commit.commit.author?.date || new Date().toISOString()
                }))
            };
        } catch (error) {
            logError(`Error comparing branches: ${error}`);
            throw error;
        }
    }

    getSizeCategoryAndReason = async (
        owner: string,
        repository: string,
        head: string,
        base: string,
        sizeThresholds: SizeThresholds,
        labels: Labels,
        token: string,
    ) => {
        try {
            const headBranchChanges = await this.getChanges(
                owner,
                repository,
                head,
                base,
                token,
            )

            const totalChanges = headBranchChanges.files.reduce((sum, file) => sum + file.changes, 0);
            const totalFiles = headBranchChanges.files.length;
            const totalCommits = headBranchChanges.totalCommits;

            let sizeCategory: string;
            let githubSize: string;
            let sizeReason: string;
            if (totalChanges > sizeThresholds.xxl.lines || totalFiles > sizeThresholds.xxl.files || totalCommits > sizeThresholds.xxl.commits) {
                sizeCategory = labels.sizeXxl;
                githubSize = `XL`;
                sizeReason = totalChanges > sizeThresholds.xxl.lines ? `More than ${sizeThresholds.xxl.lines} lines changed` :
                            totalFiles > sizeThresholds.xxl.files ? `More than ${sizeThresholds.xxl.files} files modified` :
                            `More than ${sizeThresholds.xxl.commits} commits`;
            } else if (totalChanges > sizeThresholds.xl.lines || totalFiles > sizeThresholds.xl.files || totalCommits > sizeThresholds.xl.commits) {
                sizeCategory = labels.sizeXl;
                githubSize = `XL`;
                sizeReason = totalChanges > sizeThresholds.xl.lines ? `More than ${sizeThresholds.xl.lines} lines changed` :
                            totalFiles > sizeThresholds.xl.files ? `More than ${sizeThresholds.xl.files} files modified` :
                            `More than ${sizeThresholds.xl.commits} commits`;
            } else if (totalChanges > sizeThresholds.l.lines || totalFiles > sizeThresholds.l.files || totalCommits > sizeThresholds.l.commits) {
                sizeCategory = labels.sizeL;
                githubSize = `L`;
                sizeReason = totalChanges > sizeThresholds.l.lines ? `More than ${sizeThresholds.l.lines} lines changed` :
                            totalFiles > sizeThresholds.l.files ? `More than ${sizeThresholds.l.files} files modified` :
                            `More than ${sizeThresholds.l.commits} commits`;
            } else if (totalChanges > sizeThresholds.m.lines || totalFiles > sizeThresholds.m.files || totalCommits > sizeThresholds.m.commits) {
                sizeCategory = labels.sizeM;
                githubSize = `M`;
                sizeReason = totalChanges > sizeThresholds.m.lines ? `More than ${sizeThresholds.m.lines} lines changed` :
                            totalFiles > sizeThresholds.m.files ? `More than ${sizeThresholds.m.files} files modified` :
                            `More than ${sizeThresholds.m.commits} commits`;
            } else if (totalChanges > sizeThresholds.s.lines || totalFiles > sizeThresholds.s.files || totalCommits > sizeThresholds.s.commits) {
                sizeCategory = labels.sizeS;
                githubSize = `S`;
                sizeReason = totalChanges > sizeThresholds.s.lines ? `More than ${sizeThresholds.s.lines} lines changed` :
                            totalFiles > sizeThresholds.s.files ? `More than ${sizeThresholds.s.files} files modified` :
                            `More than ${sizeThresholds.s.commits} commits`;
            } else {
                sizeCategory = labels.sizeXs;
                githubSize = `XS`;
                sizeReason = `Small changes (${totalChanges} lines, ${totalFiles} files)`;
            }
            
            return {
                size: sizeCategory,
                githubSize: githubSize,
                reason: sizeReason
            }
        } catch (error) {
            logError(`Error comparing branches: ${error}`);
            throw error;
        }
    }
}