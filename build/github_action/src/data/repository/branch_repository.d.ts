import { Execution } from '../model/execution';
import { Labels } from '../model/labels';
import { Result } from '../model/result';
import { SizeThresholds } from '../model/size_thresholds';
/**
 * Facade for branch-related operations. Delegates to focused repositories
 * (GitCli, Workflow, Merge, BranchCompare) for testability.
 */
export declare class BranchRepository {
    private readonly gitCliRepository;
    private readonly workflowRepository;
    private readonly mergeRepository;
    private readonly branchCompareRepository;
    fetchRemoteBranches: () => Promise<void>;
    getLatestTag: () => Promise<string | undefined>;
    getCommitTag: (latestTag: string | undefined) => Promise<string | undefined>;
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
    manageBranches: (param: Execution, owner: string, repository: string, issueNumber: number, issueTitle: string, branchType: string, developmentBranch: string, hotfixBranch: string | undefined, isHotfix: boolean, token: string) => Promise<Result[]>;
    formatBranchName: (issueTitle: string, issueNumber: number) => string;
    createLinkedBranch: (owner: string, repo: string, baseBranchName: string, newBranchName: string, issueNumber: number, oid: string | undefined, token: string) => Promise<Result[]>;
    removeBranch: (owner: string, repository: string, branch: string, token: string) => Promise<boolean>;
    getListOfBranches: (owner: string, repository: string, token: string) => Promise<string[]>;
    executeWorkflow: (owner: string, repository: string, branch: string, workflow: string, inputs: Record<string, unknown>, token: string) => Promise<import("@octokit/plugin-paginate-rest/dist-types/types").OctokitResponse<never, 204>>;
    mergeBranch: (owner: string, repository: string, head: string, base: string, timeout: number, token: string) => Promise<Result[]>;
    getChanges: (owner: string, repository: string, head: string, base: string, token: string) => Promise<import("./branch_compare_repository").BranchComparison>;
    getSizeCategoryAndReason: (owner: string, repository: string, head: string, base: string, sizeThresholds: SizeThresholds, labels: Labels, token: string) => Promise<import("./branch_compare_repository").SizeCategoryResult>;
}
