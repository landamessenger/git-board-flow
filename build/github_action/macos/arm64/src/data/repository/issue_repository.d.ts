import { Labels } from "../model/labels";
import { Milestone } from "../model/milestone";
import { IssueTypes } from "../model/issue_types";
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
}
