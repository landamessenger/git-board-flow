import * as exec from '@actions/exec';
import * as core from '@actions/core';
import * as github from "@actions/github";
import {Result} from "../model/result";
import {Execution} from "../model/execution";

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
            let latestTag = '';
            await exec.exec('git', ['tag', '--sort=-creatordate'], {
                listeners: {
                    stdout: (data: Buffer) => {
                        latestTag = data.toString().split('\n')[0];
                    },
                },
            });

            core.info(`Latest tag: ${latestTag}`);

            return latestTag;
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

            core.info(`Fetching commit hash for the tag: ${latestTag}`);
            let commitOid = '';
            await exec.exec('git', ['rev-list', '-n', '1', latestTag], {
                listeners: {
                    stdout: (data: Buffer) => {
                        commitOid = data.toString().trim(); // Obtener el hash del commit
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
            param.currentConfiguration.issueBranch = newBranchName;
            if (branches.indexOf(newBranchName) > -1) {
                result.push(
                    new Result({
                        id: 'branch_repository',
                        success: true,
                        executed: false,
                        steps: [
                            `The branch \`${newBranchName}\` already exist. Skipping creation.`
                        ],
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
        let sanitizedTitle = issueTitle.toLowerCase();

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

}