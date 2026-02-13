import * as github from '@actions/github';
import { logDebugInfo, logError } from '../../utils/logger';
import { Labels } from '../model/labels';
import { SizeThresholds } from '../model/size_thresholds';

export interface BranchComparisonFile {
    filename: string;
    status: string;
    additions: number;
    deletions: number;
    changes: number;
    blobUrl: string;
    rawUrl: string;
    contentsUrl: string;
    patch: string | undefined;
}

export interface BranchComparisonCommit {
    sha: string;
    message: string;
    author: { name: string; email: string; date: string };
    date: string;
}

export interface BranchComparison {
    aheadBy: number;
    behindBy: number;
    totalCommits: number;
    files: BranchComparisonFile[];
    commits: BranchComparisonCommit[];
}

export interface SizeCategoryResult {
    size: string;
    githubSize: string;
    reason: string;
}

/**
 * Repository for comparing branches and computing size categories.
 * Isolated to allow unit tests with mocked Octokit and pure size logic.
 */
export class BranchCompareRepository {

    getChanges = async (
        owner: string,
        repository: string,
        head: string,
        base: string,
        token: string,
    ): Promise<BranchComparison> => {
        try {
            const octokit = github.getOctokit(token);

            logDebugInfo(`Comparing branches: ${head} with ${base}`);

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
                additions: file.additions ?? 0,
                deletions: file.deletions ?? 0,
                changes: file.changes ?? 0,
                blobUrl: file.blob_url,
                rawUrl: file.raw_url,
                contentsUrl: file.contents_url,
                patch: file.patch,
            })),
            commits: comparison.commits.map(commit => {
                const author = commit.commit.author;
                return {
                    sha: commit.sha,
                    message: commit.commit.message,
                    author: {
                        name: author?.name ?? 'Unknown',
                        email: author?.email ?? 'unknown@example.com',
                        date: author?.date ?? new Date().toISOString(),
                    },
                    date: author?.date ?? new Date().toISOString(),
                };
            }),
        };
        } catch (error) {
            logError(`Error comparing branches: ${error}`);
            throw error;
        }
    };

    getSizeCategoryAndReason = async (
        owner: string,
        repository: string,
        head: string,
        base: string,
        sizeThresholds: SizeThresholds,
        labels: Labels,
        token: string,
    ): Promise<SizeCategoryResult> => {
        try {
            const headBranchChanges = await this.getChanges(
                owner,
                repository,
                head,
                base,
                token,
            );

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
                reason: sizeReason,
            };
        } catch (error) {
            logError(`Error comparing branches: ${error}`);
            throw error;
        }
    };
}
