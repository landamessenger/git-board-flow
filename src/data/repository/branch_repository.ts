import * as exec from '@actions/exec';
import * as core from '@actions/core';
import * as github from "@actions/github";

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
     * Returns the feature/bugfix branch origin.
     *
     * @param token
     * @param issueNumber
     * @param issueTitle
     * @param branchType
     * @param developmentBranch
     * @param hotfixBranch
     * @param isHotfix
     */
    manageBranches = async (
        token: string,
        issueNumber: number,
        issueTitle: string,
        branchType: string,
        developmentBranch: string,
        hotfixBranch: string,
        isHotfix: boolean,
    ): Promise<string | undefined> => {
        core.info(`Managing branches`);

        const octokit = github.getOctokit(token);

        const sanitizedTitle = this.formatBranchName(issueTitle, issueNumber);

        const newBranchName = `${branchType}/${issueNumber}-${sanitizedTitle}`;


        const branchTypes = ["feature", "bugfix"];

        /**
         * Default base branch name. (ex. [develop])
         */
        let baseBranchName = developmentBranch;

        let featureOrBugfixOrigin: string | undefined
        if (!isHotfix) {
            /**
             * Check if it is a branch switch: feature/123-bla <-> bugfix/123-bla
             */
            core.info(`Searching for branches related to issue #${issueNumber}...`);

            const {data} = await octokit.rest.repos.listBranches({
                owner: github.context.repo.owner,
                repo: github.context.repo.repo,
            });

            for (const type of branchTypes) {
                const prefix = `${type}/${issueNumber}-`;

                try {
                    const matchingBranch = data.find(branch => branch.name.indexOf(prefix) > -1);

                    if (matchingBranch) {
                        baseBranchName = matchingBranch.name;
                        core.info(`Found previous issue branch: ${baseBranchName}`);
                        break;
                    }
                } catch (error) {
                    core.info(`Error while listing branches: ${error}`);
                    throw error;
                }
            }
        } else {
            baseBranchName = hotfixBranch;
            featureOrBugfixOrigin = baseBranchName
        }

        if (featureOrBugfixOrigin === undefined) {
            featureOrBugfixOrigin = developmentBranch
        }

        core.info(`============================================================================================`);
        core.info(`Base branch: ${baseBranchName}`);
        core.info(`New branch: ${newBranchName}`);
        core.info(`Finish branch: ${featureOrBugfixOrigin}`);

        await this.createLinkedBranch(token, baseBranchName, newBranchName, issueNumber, undefined)

        return featureOrBugfixOrigin;
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
        token: string,
        baseBranchName: string,
        newBranchName: string,
        issueNumber: number,
        oid: string | undefined,
    ): Promise<LinkedBranchResponse | undefined> => {
        core.info(`Creating linked branch ${newBranchName} from ${oid ?? baseBranchName}`)

        const octokit = github.getOctokit(token);
        const {repository} = await octokit.graphql<RepositoryResponse>(`
              query($repo: String!, $owner: String!, $issueNumber: Int!) {
                repository(name: $repo, owner: $owner) {
                  id
                  issue(number: $issueNumber) {
                    id
                  }
                  ref(qualifiedName: "refs/heads/${baseBranchName}") {
                    target {
                      ... on Commit {
                        oid
                      }
                    }
                  }
                }
              }
            `, {
            repo: github.context.repo.repo,
            owner: github.context.repo.owner,
            issueNumber: issueNumber
        });

        core.info(`Repository information retrieved: ${JSON.stringify(repository?.ref)}`)

        const repositoryId: string | undefined = repository?.id ?? undefined;
        const issueId: string | undefined = repository?.issue?.id ?? undefined;
        const branchOid: string | undefined = oid ?? repository?.ref?.target?.oid ?? undefined;

        if (repositoryId === undefined || issueNumber === undefined || branchOid === undefined) {
            core.error(`Error searching repository "${baseBranchName}": id: ${repositoryId}, oid: ${branchOid}), issue #${issueNumber}`);
            return;
        }

        core.info(`Linking branch "${newBranchName}" (oid: ${branchOid}) to issue #${issueNumber}`);

        try {
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

            core.info(`Linked branch: ${JSON.stringify(mutationResponse.createLinkedBranch)}`);

            return mutationResponse;
        } catch (e) {
            core.error(`Error Linking branch "${e}"`);
            return undefined;
        }
    }

    removeBranch = async (token: string, branch: string): Promise<boolean> => {
        const octokit = github.getOctokit(token);

        const ref = `heads/${branch}`;

        try {
            const {data} = await octokit.rest.git.getRef({
                owner: github.context.repo.owner,
                repo: github.context.repo.repo,
                ref,
            });

            core.info(`Branch found: ${data.ref}`);

            await octokit.rest.git.deleteRef({
                owner: github.context.repo.owner,
                repo: github.context.repo.repo,
                ref,
            });

            core.info(`Successfully deleted branch: ${branch}`);

            return true;
        } catch (error) {
            core.error(`Error processing branch ${branch}: ${error}`);
            throw error;
        }
    }

    getListOfBranches = async (token: string): Promise<string[]> => {
        const octokit = github.getOctokit(token);
        const {data} = await octokit.rest.repos.listBranches({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
        });
        return data.map(branch => branch.name);
    }

}