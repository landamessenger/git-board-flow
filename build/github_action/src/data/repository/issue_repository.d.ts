import { Labels } from "../model/labels";
import { Milestone } from "../model/milestone";
import { IssueTypes } from "../model/issue_types";
/** Matches labels that are progress percentages (e.g. "0%", "85%"). Used for setProgressLabel and syncing. */
export declare const PROGRESS_LABEL_PATTERN: RegExp;
export declare class IssueRepository {
    updateTitleIssueFormat: (owner: string, repository: string, version: string, issueTitle: string, issueNumber: number, branchManagementAlways: boolean, branchManagementEmoji: string, labels: Labels, token: string) => Promise<string | undefined>;
    updateTitlePullRequestFormat: (owner: string, repository: string, pullRequestTitle: string, issueTitle: string, issueNumber: number, pullRequestNumber: number, branchManagementAlways: boolean, branchManagementEmoji: string, labels: Labels, token: string) => Promise<string | undefined>;
    cleanTitle: (owner: string, repository: string, issueTitle: string, issueNumber: number, token: string) => Promise<string | undefined>;
    updateDescription: (owner: string, repo: string, issueNumber: number, description: string, token: string) => Promise<void>;
    getDescription: (owner: string, repo: string, issueNumber: number, token: string) => Promise<string | undefined>;
    getId: (owner: string, repository: string, issueNumber: number, token: string) => Promise<string>;
    getMilestone: (owner: string, repository: string, issueNumber: number, token: string) => Promise<Milestone | undefined>;
    getTitle: (owner: string, repository: string, issueNumber: number, token: string) => Promise<string | undefined>;
    getLabels: (owner: string, repository: string, issueNumber: number, token: string) => Promise<string[]>;
    setLabels: (owner: string, repository: string, issueNumber: number, labels: string[], token: string) => Promise<void>;
    /** Progress labels: 0%, 5%, 10%, ..., 100% (multiples of 5). */
    private static readonly PROGRESS_LABEL_PERCENTS;
    /**
     * Returns 6-char hex color for progress (no leading #).
     * 0% = red, 50% = yellow, 100% = green, with linear interpolation.
     */
    private static progressPercentToColor;
    /**
     * Ensures progress labels (0%, 5%, ..., 100%) exist in the repo with red→yellow→green colors.
     */
    ensureProgressLabels: (owner: string, repository: string, token: string) => Promise<{
        created: number;
        existing: number;
        errors: string[];
    }>;
    /**
     * Sets the progress label on the issue: removes any existing percentage label and adds the new one.
     * Progress is rounded to the nearest 5 (0, 5, 10, ..., 100).
     */
    setProgressLabel: (owner: string, repository: string, issueNumber: number, progress: number, token: string) => Promise<void>;
    isIssue: (owner: string, repository: string, issueNumber: number, token: string) => Promise<boolean>;
    isPullRequest: (owner: string, repository: string, issueNumber: number, token: string) => Promise<boolean>;
    getHeadBranch: (owner: string, repository: string, issueNumber: number, token: string) => Promise<string | undefined>;
    addComment: (owner: string, repository: string, issueNumber: number, comment: string, token: string) => Promise<void>;
    updateComment: (owner: string, repository: string, issueNumber: number, commentId: number, comment: string, token: string) => Promise<void>;
    closeIssue: (owner: string, repository: string, issueNumber: number, token: string) => Promise<boolean>;
    openIssue: (owner: string, repository: string, issueNumber: number, token: string) => Promise<boolean>;
    getCurrentAssignees: (owner: string, repository: string, issueNumber: number, token: string) => Promise<string[]>;
    assignMembersToIssue: (owner: string, repository: string, issueNumber: number, members: string[], token: string) => Promise<string[]>;
    getIssueDescription: (owner: string, repository: string, issueNumber: number, token: string) => Promise<string>;
    setIssueType: (owner: string, repository: string, issueNumber: number, labels: Labels, issueTypes: IssueTypes, token: string) => Promise<void>;
    /**
     * List all labels for a repository
     */
    listLabelsForRepo: (owner: string, repository: string, token: string) => Promise<Array<{
        name: string;
        color: string;
        description: string | null;
    }>>;
    /**
     * Create a label in a repository
     */
    createLabel: (owner: string, repository: string, name: string, color: string, description: string, token: string) => Promise<void>;
    /**
     * Ensure a label exists, creating it if it doesn't
     */
    ensureLabel: (owner: string, repository: string, name: string, color: string, description: string, token: string) => Promise<{
        created: boolean;
        existed: boolean;
    }>;
    /**
     * Ensure all required labels exist based on Labels configuration
     */
    ensureLabels: (owner: string, repository: string, labels: Labels, token: string) => Promise<{
        created: number;
        existing: number;
        errors: string[];
    }>;
    /**
     * List all issue types for an organization
     */
    listIssueTypes: (owner: string, token: string) => Promise<Array<{
        id: string;
        name: string;
    }>>;
    /**
     * Create an issue type for an organization
     */
    createIssueType: (owner: string, name: string, description: string, color: string, token: string) => Promise<string>;
    /**
     * Ensure an issue type exists, creating it if it doesn't
     */
    ensureIssueType: (owner: string, name: string, description: string, color: string, token: string) => Promise<{
        created: boolean;
        existed: boolean;
    }>;
    /**
     * Ensure all required issue types exist based on IssueTypes configuration
     */
    ensureIssueTypes: (owner: string, issueTypes: IssueTypes, token: string) => Promise<{
        created: number;
        existing: number;
        errors: string[];
    }>;
}
