import { Execution } from "../model/execution";
import { Labels } from '../model/labels';
import { Result } from "../model/result";
import { SizeThresholds } from '../model/size_thresholds';
export declare class BranchRepository {
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
    executeWorkflow: (owner: string, repository: string, branch: string, workflow: string, inputs: any, token: string) => Promise<import("@octokit/plugin-paginate-rest/dist-types/types").OctokitResponse<never, 204>>;
    mergeBranch: (owner: string, repository: string, head: string, base: string, timeout: number, token: string) => Promise<Result[]>;
    getChanges: (owner: string, repository: string, head: string, base: string, token: string) => Promise<{
        aheadBy: number;
        behindBy: number;
        totalCommits: number;
        files: {
            filename: string;
            status: "added" | "removed" | "modified" | "renamed" | "copied" | "changed" | "unchanged";
            additions: number;
            deletions: number;
            changes: number;
            blobUrl: string;
            rawUrl: string;
            contentsUrl: string;
            patch: string | undefined;
        }[];
        commits: {
            sha: string;
            message: string;
            author: {
                name?: string;
                email?: string;
                date?: string;
            };
            date: string;
        }[];
    }>;
    getSizeCategoryAndReason: (owner: string, repository: string, head: string, base: string, sizeThresholds: SizeThresholds, labels: Labels, token: string) => Promise<{
        size: string;
        githubSize: string;
        reason: string;
    }>;
}
