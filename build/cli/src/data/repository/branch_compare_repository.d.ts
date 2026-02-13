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
    author: {
        name: string;
        email: string;
        date: string;
    };
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
export declare class BranchCompareRepository {
    getChanges: (owner: string, repository: string, head: string, base: string, token: string) => Promise<BranchComparison>;
    getSizeCategoryAndReason: (owner: string, repository: string, head: string, base: string, sizeThresholds: SizeThresholds, labels: Labels, token: string) => Promise<SizeCategoryResult>;
}
