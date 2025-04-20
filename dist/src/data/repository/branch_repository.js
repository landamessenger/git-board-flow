"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.BranchRepository = void 0;
const core = __importStar(require("@actions/core"));
const exec = __importStar(require("@actions/exec"));
const github = __importStar(require("@actions/github"));
const logger_1 = require("../../utils/logger");
const version_utils_1 = require("../../utils/version_utils");
const result_1 = require("../model/result");
class BranchRepository {
    constructor() {
        this.fetchRemoteBranches = async () => {
            try {
                (0, logger_1.logDebugInfo)('Fetching tags and forcing fetch...');
                await exec.exec('git', ['fetch', '--tags', '--force']);
                (0, logger_1.logDebugInfo)('Fetching all remote branches with verbose output...');
                await exec.exec('git', ['fetch', '--all', '-v']);
                (0, logger_1.logDebugInfo)('Successfully fetched all remote branches.');
            }
            catch (error) {
                core.setFailed(`Error fetching remote branches: ${error}`);
            }
        };
        this.getLatestTag = async () => {
            try {
                (0, logger_1.logDebugInfo)('Fetching the latest tag...');
                await exec.exec('git', ['fetch', '--tags']);
                const tags = [];
                await exec.exec('git', ['tag', '--sort=-creatordate'], {
                    listeners: {
                        stdout: (data) => {
                            tags.push(...data.toString().split('\n').map((v, i, a) => {
                                return v.replace('v', '');
                            }));
                        },
                    },
                });
                const validTags = tags.filter(tag => /\d+\.\d+\.\d+$/.test(tag));
                if (validTags.length > 0) {
                    const latestTag = (0, version_utils_1.getLatestVersion)(validTags);
                    (0, logger_1.logDebugInfo)(`Latest tag: ${latestTag}`);
                    return latestTag;
                }
                else {
                    (0, logger_1.logDebugInfo)('No valid tags found.');
                    return undefined;
                }
            }
            catch (error) {
                core.setFailed(`Error fetching the latest tag: ${error}`);
                return undefined;
            }
        };
        this.getCommitTag = async (latestTag) => {
            try {
                if (!latestTag) {
                    core.setFailed('No LATEST_TAG found in the environment');
                    return;
                }
                let tagVersion;
                if (latestTag.startsWith('v')) {
                    tagVersion = latestTag;
                }
                else {
                    tagVersion = `v${latestTag}`;
                }
                (0, logger_1.logDebugInfo)(`Fetching commit hash for the tag: ${tagVersion}`);
                let commitOid = '';
                await exec.exec('git', ['rev-list', '-n', '1', tagVersion], {
                    listeners: {
                        stdout: (data) => {
                            commitOid = data.toString().trim();
                        },
                    },
                });
                if (commitOid) {
                    (0, logger_1.logDebugInfo)(`Commit tag: ${commitOid}`);
                    return commitOid;
                }
                else {
                    core.setFailed('No commit found for the tag');
                }
            }
            catch (error) {
                core.setFailed(`Error fetching the commit hash: ${error}`);
            }
            return undefined;
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
        this.manageBranches = async (param, owner, repository, issueNumber, issueTitle, branchType, developmentBranch, hotfixBranch, isHotfix, token) => {
            const result = [];
            try {
                (0, logger_1.logDebugInfo)(`Managing branches`);
                const branches = await this.getListOfBranches(owner, repository, token);
                (0, logger_1.logDebugInfo)(JSON.stringify(branches, null, 2));
                if (hotfixBranch === undefined && isHotfix) {
                    result.push(new result_1.Result({
                        id: 'branch_repository',
                        success: false,
                        executed: true,
                        steps: [
                            `Tried to prepare the hotfix branch of the issue, but hotfix branch was not found.`,
                        ],
                    }));
                    return result;
                }
                const octokit = github.getOctokit(token);
                const sanitizedTitle = this.formatBranchName(issueTitle, issueNumber);
                const newBranchName = `${branchType}/${issueNumber}-${sanitizedTitle}`;
                if (branches.indexOf(newBranchName) > -1) {
                    result.push(new result_1.Result({
                        id: 'branch_repository',
                        success: true,
                        executed: false,
                    }));
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
                if (!isHotfix) {
                    /**
                     * Check if it is a branch switch: feature/123-bla <-> bugfix/123-bla
                     */
                    (0, logger_1.logDebugInfo)(`Searching for branches related to issue #${issueNumber}...`);
                    const { data } = await octokit.rest.repos.listBranches({
                        owner: owner,
                        repo: repository,
                    });
                    for (const type of branchTypes) {
                        const prefix = `${type}/${issueNumber}-`;
                        try {
                            const matchingBranch = data.find(branch => branch.name.indexOf(prefix) > -1);
                            if (matchingBranch) {
                                baseBranchName = matchingBranch.name;
                                (0, logger_1.logDebugInfo)(`Found previous issue branch: ${baseBranchName}`);
                                // TODO replacedBranchName = baseBranchName
                                break;
                            }
                        }
                        catch (error) {
                            (0, logger_1.logError)(`Error while listing branches: ${error}`);
                            result.push(new result_1.Result({
                                id: 'branch_repository',
                                success: false,
                                executed: true,
                                steps: [
                                    `Error while listing branches.`,
                                ],
                                error: error,
                            }));
                        }
                    }
                }
                else {
                    baseBranchName = hotfixBranch ?? developmentBranch;
                }
                param.currentConfiguration.parentBranch = baseBranchName;
                (0, logger_1.logDebugInfo)(`============================================================================================`);
                (0, logger_1.logDebugInfo)(`Base branch: ${baseBranchName}`);
                (0, logger_1.logDebugInfo)(`New branch: ${newBranchName}`);
                result.push(...await this.createLinkedBranch(owner, repository, baseBranchName, newBranchName, issueNumber, undefined, token));
            }
            catch (error) {
                (0, logger_1.logError)(error);
                result.push(new result_1.Result({
                    id: 'branch_repository',
                    success: false,
                    executed: true,
                    steps: [
                        `Tried to prepare the hotfix to the issue, but there was a problem.`,
                    ],
                    error: error,
                }));
            }
            return result;
        };
        this.formatBranchName = (issueTitle, issueNumber) => {
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
        };
        this.createLinkedBranch = async (owner, repo, baseBranchName, newBranchName, issueNumber, oid, token) => {
            const result = [];
            try {
                (0, logger_1.logDebugInfo)(`Creating linked branch ${newBranchName} from ${oid ?? baseBranchName}`);
                let ref = `heads/${baseBranchName}`;
                if (baseBranchName.indexOf('tags/') > -1) {
                    ref = baseBranchName;
                }
                const octokit = github.getOctokit(token);
                const { repository } = await octokit.graphql(`
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
                (0, logger_1.logDebugInfo)(`Repository information retrieved: ${JSON.stringify(repository?.ref)}`);
                const repositoryId = repository?.id ?? undefined;
                const issueId = repository?.issue?.id ?? undefined;
                const branchOid = oid ?? repository?.ref?.target?.oid ?? undefined;
                if (repositoryId === undefined || issueNumber === undefined || branchOid === undefined) {
                    (0, logger_1.logError)(`Error searching repository "${baseBranchName}": id: ${repositoryId}, oid: ${branchOid}), issue #${issueNumber}`);
                    result.push(new result_1.Result({
                        id: 'branch_repository',
                        success: false,
                        executed: true,
                        steps: [
                            `Error linking branch ${newBranchName} to issue: Repository not found.`,
                        ],
                    }));
                    return result;
                }
                (0, logger_1.logDebugInfo)(`Linking branch "${newBranchName}" (oid: ${branchOid}) to issue #${issueNumber}`);
                const mutationResponse = await octokit.graphql(`
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
                (0, logger_1.logDebugInfo)(`Linked branch: ${JSON.stringify(mutationResponse.createLinkedBranch?.linkedBranch)}`);
                const baseBranchUrl = `https://github.com/${owner}/${repo}/tree/${baseBranchName}`;
                const newBranchUrl = `https://github.com/${owner}/${repo}/tree/${newBranchName}`;
                result.push(new result_1.Result({
                    id: 'branch_repository',
                    success: true,
                    executed: true,
                    payload: {
                        baseBranchName: baseBranchName,
                        baseBranchUrl: baseBranchUrl,
                        newBranchName: newBranchName,
                        newBranchUrl: newBranchUrl,
                    },
                }));
            }
            catch (error) {
                (0, logger_1.logError)(`Error Linking branch "${error}"`);
                result.push(new result_1.Result({
                    id: 'branch_repository',
                    success: false,
                    executed: true,
                    steps: [
                        `Tried to link branch to the issue, but there was a problem.`,
                    ],
                    error: error,
                }));
            }
            return result;
        };
        this.removeBranch = async (owner, repository, branch, token) => {
            const octokit = github.getOctokit(token);
            const ref = `heads/${branch}`;
            try {
                const { data } = await octokit.rest.git.getRef({
                    owner: owner,
                    repo: repository,
                    ref,
                });
                (0, logger_1.logDebugInfo)(`Branch found: ${data.ref}`);
                await octokit.rest.git.deleteRef({
                    owner: owner,
                    repo: repository,
                    ref,
                });
                (0, logger_1.logDebugInfo)(`Successfully deleted branch: ${branch}`);
                return true;
            }
            catch (error) {
                (0, logger_1.logError)(`Error processing branch ${branch}: ${error}`);
                throw error;
            }
        };
        this.getListOfBranches = async (owner, repository, token) => {
            const octokit = github.getOctokit(token);
            const allBranches = [];
            let page = 1;
            while (true) {
                const { data } = await octokit.rest.repos.listBranches({
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
        };
        this.executeWorkflow = async (owner, repository, branch, workflow, inputs, token) => {
            const octokit = github.getOctokit(token);
            return octokit.rest.actions.createWorkflowDispatch({
                owner: owner,
                repo: repository,
                workflow_id: workflow,
                ref: branch,
                inputs: inputs
            });
        };
        this.mergeBranch = async (owner, repository, head, base, timeout, token) => {
            const result = [];
            try {
                const octokit = github.getOctokit(token);
                (0, logger_1.logDebugInfo)(`Creating merge from ${head} into ${base}`);
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
                (0, logger_1.logDebugInfo)(`Pull request #${pullRequest.number} created, getting commits...`);
                // Get all commits in the PR
                const { data: commits } = await octokit.rest.pulls.listCommits({
                    owner: owner,
                    repo: repository,
                    pull_number: pullRequest.number
                });
                const commitMessages = commits.map(commit => commit.commit.message);
                (0, logger_1.logDebugInfo)(`Found ${commitMessages.length} commits in PR`);
                // Update PR with commit list and footer
                await octokit.rest.pulls.update({
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
                        (0, logger_1.logDebugInfo)(`Combined status state: ${commitStatus.state}`);
                        (0, logger_1.logDebugInfo)(`Number of check runs: ${checkRuns.check_runs.length}`);
                        // If there are check runs, prioritize those over status checks
                        if (checkRuns.check_runs.length > 0) {
                            const pendingCheckRuns = checkRuns.check_runs.filter(check => check.status !== 'completed');
                            if (pendingCheckRuns.length === 0) {
                                checksCompleted = true;
                                (0, logger_1.logDebugInfo)('All check runs have completed.');
                                // Verify if all checks passed
                                const failedChecks = checkRuns.check_runs.filter(check => check.conclusion === 'failure');
                                if (failedChecks.length > 0) {
                                    throw new Error(`Checks failed: ${failedChecks.map(check => check.name).join(', ')}`);
                                }
                            }
                            else {
                                (0, logger_1.logDebugInfo)(`Waiting for ${pendingCheckRuns.length} check runs to complete:`);
                                pendingCheckRuns.forEach(check => {
                                    (0, logger_1.logDebugInfo)(`  - ${check.name} (Status: ${check.status})`);
                                });
                                await new Promise(resolve => setTimeout(resolve, iteration * 1000));
                                attempts++;
                                continue;
                            }
                        }
                        else {
                            // Fall back to status checks if no check runs exist
                            const pendingChecks = commitStatus.statuses.filter(status => {
                                (0, logger_1.logDebugInfo)(`Status check: ${status.context} (State: ${status.state})`);
                                return status.state === 'pending';
                            });
                            if (pendingChecks.length === 0) {
                                checksCompleted = true;
                                (0, logger_1.logDebugInfo)('All status checks have completed.');
                            }
                            else {
                                (0, logger_1.logDebugInfo)(`Waiting for ${pendingChecks.length} status checks to complete:`);
                                pendingChecks.forEach(check => {
                                    (0, logger_1.logDebugInfo)(`  - ${check.context} (State: ${check.state})`);
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
                result.push(new result_1.Result({
                    id: 'branch_repository',
                    success: true,
                    executed: true,
                    steps: [
                        `The branch \`${head}\` was merged into \`${base}\`.`,
                    ],
                }));
            }
            catch (error) {
                (0, logger_1.logError)(`Error in PR workflow: ${error}`);
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
                    result.push(new result_1.Result({
                        id: 'branch_repository',
                        success: true,
                        executed: true,
                        steps: [
                            `The branch \`${head}\` was merged into \`${base}\` using direct merge.`,
                        ],
                    }));
                    return result;
                }
                catch (directMergeError) {
                    (0, logger_1.logError)(`Error in direct merge attempt: ${directMergeError}`);
                    result.push(new result_1.Result({
                        id: 'branch_repository',
                        success: false,
                        executed: true,
                        steps: [
                            `Failed to merge branch \`${head}\` into \`${base}\`.`,
                        ],
                    }));
                    result.push(new result_1.Result({
                        id: 'branch_repository',
                        success: false,
                        executed: true,
                        error: error,
                    }));
                    result.push(new result_1.Result({
                        id: 'branch_repository',
                        success: false,
                        executed: true,
                        error: directMergeError,
                    }));
                }
            }
            return result;
        };
        this.getChanges = async (owner, repository, head, base, token) => {
            const octokit = github.getOctokit(token);
            try {
                (0, logger_1.logDebugInfo)(`Comparing branches: ${head} with ${base}`);
                let headRef = `heads/${head}`;
                if (head.indexOf('tags/') > -1) {
                    headRef = head;
                }
                let baseRef = `heads/${base}`;
                if (base.indexOf('tags/') > -1) {
                    baseRef = base;
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
            }
            catch (error) {
                (0, logger_1.logError)(`Error comparing branches: ${error}`);
                throw error;
            }
        };
        this.getSizeCategoryAndReason = async (owner, repository, head, base, sizeThresholds, labels, token) => {
            try {
                const headBranchChanges = await this.getChanges(owner, repository, head, base, token);
                const totalChanges = headBranchChanges.files.reduce((sum, file) => sum + file.changes, 0);
                const totalFiles = headBranchChanges.files.length;
                const totalCommits = headBranchChanges.totalCommits;
                let sizeCategory;
                let githubSize;
                let sizeReason;
                if (totalChanges > sizeThresholds.xxl.lines || totalFiles > sizeThresholds.xxl.files || totalCommits > sizeThresholds.xxl.commits) {
                    sizeCategory = labels.sizeXxl;
                    githubSize = `XL`;
                    sizeReason = totalChanges > sizeThresholds.xxl.lines ? `More than ${sizeThresholds.xxl.lines} lines changed` :
                        totalFiles > sizeThresholds.xxl.files ? `More than ${sizeThresholds.xxl.files} files modified` :
                            `More than ${sizeThresholds.xxl.commits} commits`;
                }
                else if (totalChanges > sizeThresholds.xl.lines || totalFiles > sizeThresholds.xl.files || totalCommits > sizeThresholds.xl.commits) {
                    sizeCategory = labels.sizeXl;
                    githubSize = `XL`;
                    sizeReason = totalChanges > sizeThresholds.xl.lines ? `More than ${sizeThresholds.xl.lines} lines changed` :
                        totalFiles > sizeThresholds.xl.files ? `More than ${sizeThresholds.xl.files} files modified` :
                            `More than ${sizeThresholds.xl.commits} commits`;
                }
                else if (totalChanges > sizeThresholds.l.lines || totalFiles > sizeThresholds.l.files || totalCommits > sizeThresholds.l.commits) {
                    sizeCategory = labels.sizeL;
                    githubSize = `L`;
                    sizeReason = totalChanges > sizeThresholds.l.lines ? `More than ${sizeThresholds.l.lines} lines changed` :
                        totalFiles > sizeThresholds.l.files ? `More than ${sizeThresholds.l.files} files modified` :
                            `More than ${sizeThresholds.l.commits} commits`;
                }
                else if (totalChanges > sizeThresholds.m.lines || totalFiles > sizeThresholds.m.files || totalCommits > sizeThresholds.m.commits) {
                    sizeCategory = labels.sizeM;
                    githubSize = `M`;
                    sizeReason = totalChanges > sizeThresholds.m.lines ? `More than ${sizeThresholds.m.lines} lines changed` :
                        totalFiles > sizeThresholds.m.files ? `More than ${sizeThresholds.m.files} files modified` :
                            `More than ${sizeThresholds.m.commits} commits`;
                }
                else if (totalChanges > sizeThresholds.s.lines || totalFiles > sizeThresholds.s.files || totalCommits > sizeThresholds.s.commits) {
                    sizeCategory = labels.sizeS;
                    githubSize = `S`;
                    sizeReason = totalChanges > sizeThresholds.s.lines ? `More than ${sizeThresholds.s.lines} lines changed` :
                        totalFiles > sizeThresholds.s.files ? `More than ${sizeThresholds.s.files} files modified` :
                            `More than ${sizeThresholds.s.commits} commits`;
                }
                else {
                    sizeCategory = labels.sizeXs;
                    githubSize = `XS`;
                    sizeReason = `Small changes (${totalChanges} lines, ${totalFiles} files)`;
                }
                return {
                    size: sizeCategory,
                    githubSize: githubSize,
                    reason: sizeReason
                };
            }
            catch (error) {
                (0, logger_1.logError)(`Error comparing branches: ${error}`);
                throw error;
            }
        };
    }
}
exports.BranchRepository = BranchRepository;
