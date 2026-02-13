import * as github from '@actions/github';
import { logDebugInfo, logError } from '../../utils/logger';
import { LinkedBranchResponse } from '../graph/linked_branch_response';
import { RepositoryResponse } from '../graph/repository_response';
import { Execution } from '../model/execution';
import { Labels } from '../model/labels';
import { Result } from '../model/result';
import { SizeThresholds } from '../model/size_thresholds';
import { BranchCompareRepository } from './branch_compare_repository';
import { GitCliRepository } from './git_cli_repository';
import { MergeRepository } from './merge_repository';
import { WorkflowRepository } from './workflow_repository';

/**
 * Facade for branch-related operations. Delegates to focused repositories
 * (GitCli, Workflow, Merge, BranchCompare) for testability.
 */
export class BranchRepository {

    private readonly gitCliRepository = new GitCliRepository();
    private readonly workflowRepository = new WorkflowRepository();
    private readonly mergeRepository = new MergeRepository();
    private readonly branchCompareRepository = new BranchCompareRepository();

    fetchRemoteBranches = async (): Promise<void> => {
        return this.gitCliRepository.fetchRemoteBranches();
    };

    getLatestTag = async (): Promise<string | undefined> => {
        return this.gitCliRepository.getLatestTag();
    };

    getCommitTag = async (latestTag: string | undefined): Promise<string | undefined> => {
        return this.gitCliRepository.getCommitTag(latestTag);
    };

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
        return this.workflowRepository.executeWorkflow(owner, repository, branch, workflow, inputs, token);
    };

    mergeBranch = async (
        owner: string,
        repository: string,
        head: string,
        base: string,
        timeout: number,
        token: string,
    ): Promise<Result[]> => {
        return this.mergeRepository.mergeBranch(owner, repository, head, base, timeout, token);
    };

    getChanges = async (
        owner: string,
        repository: string,
        head: string,
        base: string,
        token: string,
    ) => {
        return this.branchCompareRepository.getChanges(owner, repository, head, base, token);
    };

    getSizeCategoryAndReason = async (
        owner: string,
        repository: string,
        head: string,
        base: string,
        sizeThresholds: SizeThresholds,
        labels: Labels,
        token: string,
    ) => {
        return this.branchCompareRepository.getSizeCategoryAndReason(
            owner,
            repository,
            head,
            base,
            sizeThresholds,
            labels,
            token,
        );
    };
}