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
exports.IssueRepository = void 0;
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const logger_1 = require("../../utils/logger");
const milestone_1 = require("../model/milestone");
class IssueRepository {
    constructor() {
        this.updateTitleIssueFormat = async (owner, repository, version, issueTitle, issueNumber, branchManagementAlways, branchManagementEmoji, labels, token) => {
            try {
                const octokit = github.getOctokit(token);
                let emoji = '🤖';
                const branched = branchManagementAlways || labels.containsBranchedLabel;
                if (labels.isHotfix && branched) {
                    emoji = `🔥${branchManagementEmoji}`;
                }
                else if (labels.isRelease && branched) {
                    emoji = `🚀${branchManagementEmoji}`;
                }
                else if ((labels.isBugfix || labels.isBug) && branched) {
                    emoji = `🐛${branchManagementEmoji}`;
                }
                else if ((labels.isFeature || labels.isEnhancement) && branched) {
                    emoji = `✨${branchManagementEmoji}`;
                }
                else if ((labels.isDocs || labels.isDocumentation) && branched) {
                    emoji = `📝${branchManagementEmoji}`;
                }
                else if ((labels.isChore || labels.isMaintenance) && branched) {
                    emoji = `🔧${branchManagementEmoji}`;
                }
                else if (labels.isHotfix) {
                    emoji = '🔥';
                }
                else if (labels.isRelease) {
                    emoji = '🚀';
                }
                else if ((labels.isDocs || labels.isDocumentation)) {
                    emoji = '📝';
                }
                else if (labels.isChore || labels.isMaintenance) {
                    emoji = '🔧';
                }
                else if (labels.isBugfix || labels.isBug) {
                    emoji = '🐛';
                }
                else if (labels.isFeature || labels.isEnhancement) {
                    emoji = '✨';
                }
                else if (labels.isHelp) {
                    emoji = '🆘';
                }
                else if (labels.isQuestion) {
                    emoji = '❓';
                }
                let sanitizedTitle = issueTitle
                    .replace(/\b\d+(\.\d+){2,}\b/g, '')
                    .replace(/[^\p{L}\p{N}\p{P}\p{Z}^$\n]/gu, '')
                    .replace(/\u200D/g, '')
                    .replace(/[^\S\r\n]+/g, ' ')
                    .replace(/[^a-zA-Z0-9 .]/g, '')
                    .replace(/^-+|-+$/g, '')
                    .replace(/- -/g, '-').trim()
                    .replace(/-+/g, '-')
                    .trim();
                let formattedTitle = `${emoji} - ${sanitizedTitle}`;
                if (version.length > 0) {
                    formattedTitle = `${emoji} - ${version} - ${sanitizedTitle}`;
                }
                if (formattedTitle !== issueTitle) {
                    await octokit.rest.issues.update({
                        owner: owner,
                        repo: repository,
                        issue_number: issueNumber,
                        title: formattedTitle,
                    });
                    (0, logger_1.logDebugInfo)(`Issue title updated to: ${formattedTitle}`);
                    return formattedTitle;
                }
                return undefined;
            }
            catch (error) {
                core.setFailed(`Failed to check or update issue title: ${error}`);
                return undefined;
            }
        };
        this.updateTitlePullRequestFormat = async (owner, repository, pullRequestTitle, issueTitle, issueNumber, pullRequestNumber, branchManagementAlways, branchManagementEmoji, labels, token) => {
            try {
                const octokit = github.getOctokit(token);
                let emoji = '🤖';
                const branched = branchManagementAlways || labels.containsBranchedLabel;
                if (labels.isHotfix && branched) {
                    emoji = `🔥${branchManagementEmoji}`;
                }
                else if (labels.isRelease && branched) {
                    emoji = `🚀${branchManagementEmoji}`;
                }
                else if ((labels.isBugfix || labels.isBug) && branched) {
                    emoji = `🐛${branchManagementEmoji}`;
                }
                else if ((labels.isFeature || labels.isEnhancement) && branched) {
                    emoji = `✨${branchManagementEmoji}`;
                }
                else if ((labels.isDocs || labels.isDocumentation) && branched) {
                    emoji = `📝${branchManagementEmoji}`;
                }
                else if ((labels.isChore || labels.isMaintenance) && branched) {
                    emoji = `🔧${branchManagementEmoji}`;
                }
                else if (labels.isHotfix) {
                    emoji = '🔥';
                }
                else if (labels.isRelease) {
                    emoji = '🚀';
                }
                else if (labels.isBugfix || labels.isBug) {
                    emoji = '🐛';
                }
                else if (labels.isFeature || labels.isEnhancement) {
                    emoji = '✨';
                }
                else if (labels.isDocs || labels.isDocumentation) {
                    emoji = '📝';
                }
                else if (labels.isChore || labels.isMaintenance) {
                    emoji = '🔧';
                }
                else if (labels.isHelp) {
                    emoji = '🆘';
                }
                else if (labels.isQuestion) {
                    emoji = '❓';
                }
                let sanitizedTitle = issueTitle
                    .replace(/[^\p{L}\p{N}\p{P}\p{Z}^$\n]/gu, '')
                    .replace(/\u200D/g, '')
                    .replace(/[^\S\r\n]+/g, ' ')
                    .replace(/[^a-zA-Z0-9 ]/g, '')
                    .replace(/^-+|-+$/g, '')
                    .replace(/- -/g, '-').trim()
                    .replace(/-+/g, '-')
                    .trim();
                const formattedTitle = `[#${issueNumber}] ${emoji} - ${sanitizedTitle}`;
                if (formattedTitle !== pullRequestTitle) {
                    await octokit.rest.issues.update({
                        owner: owner,
                        repo: repository,
                        issue_number: pullRequestNumber,
                        title: formattedTitle,
                    });
                    (0, logger_1.logDebugInfo)(`Issue title updated to: ${formattedTitle}`);
                    return formattedTitle;
                }
                return undefined;
            }
            catch (error) {
                core.setFailed(`Failed to check or update issue title: ${error}`);
                return undefined;
            }
        };
        this.cleanTitle = async (owner, repository, issueTitle, issueNumber, token) => {
            try {
                const octokit = github.getOctokit(token);
                let sanitizedTitle = issueTitle
                    .replace(/[^\p{L}\p{N}\p{P}\p{Z}^$\n]/gu, '')
                    .replace(/\u200D/g, '')
                    .replace(/[^\S\r\n]+/g, ' ')
                    .replace(/[^a-zA-Z0-9 ]/g, '')
                    .replace(/^-+|-+$/g, '')
                    .replace(/- -/g, '-').trim()
                    .replace(/-+/g, '-')
                    .trim();
                if (sanitizedTitle !== issueTitle) {
                    await octokit.rest.issues.update({
                        owner: owner,
                        repo: repository,
                        issue_number: issueNumber,
                        title: sanitizedTitle,
                    });
                    (0, logger_1.logDebugInfo)(`Issue title updated to: ${sanitizedTitle}`);
                    return sanitizedTitle;
                }
                return undefined;
            }
            catch (error) {
                core.setFailed(`Failed to check or update issue title: ${error}`);
                return undefined;
            }
        };
        this.updateDescription = async (owner, repo, issueNumber, description, token) => {
            const octokit = github.getOctokit(token);
            try {
                await octokit.rest.issues.update({
                    owner,
                    repo,
                    issue_number: issueNumber,
                    body: description,
                });
            }
            catch (error) {
                (0, logger_1.logError)(`Error updating issue description: ${error}`);
                throw error;
            }
        };
        this.getDescription = async (owner, repo, issueNumber, token) => {
            if (issueNumber === -1) {
                return undefined;
            }
            const octokit = github.getOctokit(token);
            try {
                const { data: issue } = await octokit.rest.issues.get({
                    owner,
                    repo,
                    issue_number: issueNumber,
                });
                return issue.body ?? '';
            }
            catch (error) {
                (0, logger_1.logError)(`Error reading pull request configuration: ${error}`);
                return undefined;
            }
        };
        this.getId = async (owner, repository, issueNumber, token) => {
            const octokit = github.getOctokit(token);
            const issueQuery = `
          query($repo: String!, $owner: String!, $issueNumber: Int!) {
            repository(name: $repo, owner: $owner) {
              issue(number: $issueNumber) {
                id
              }
            }
          }
        `;
            const issueResult = await octokit.graphql(issueQuery, {
                owner: owner,
                repo: repository,
                issueNumber,
            });
            const issueId = issueResult.repository.issue.id;
            (0, logger_1.logDebugInfo)(`Fetched issue ID: ${issueId}`);
            return issueId;
        };
        this.getMilestone = async (owner, repository, issueNumber, token) => {
            const octokit = github.getOctokit(token);
            const { data: issue } = await octokit.rest.issues.get({
                owner: owner,
                repo: repository,
                issue_number: issueNumber,
            });
            if (issue.milestone) {
                return new milestone_1.Milestone(issue.milestone.id, issue.milestone.title, issue.milestone.description ?? '');
            }
            else {
                return undefined;
            }
        };
        this.getTitle = async (owner, repository, issueNumber, token) => {
            const octokit = github.getOctokit(token);
            try {
                const { data: issue } = await octokit.rest.issues.get({
                    owner: owner,
                    repo: repository,
                    issue_number: issueNumber,
                });
                return issue.title;
            }
            catch (error) {
                (0, logger_1.logError)(`Failed to fetch the issue title: ${error}`);
                return undefined;
            }
        };
        this.getLabels = async (owner, repository, issueNumber, token) => {
            if (issueNumber === -1) {
                return [];
            }
            const octokit = github.getOctokit(token);
            const { data: labels } = await octokit.rest.issues.listLabelsOnIssue({
                owner: owner,
                repo: repository,
                issue_number: issueNumber,
            });
            return labels.map(label => label.name);
        };
        this.setLabels = async (owner, repository, issueNumber, labels, token) => {
            const octokit = github.getOctokit(token);
            await octokit.rest.issues.setLabels({
                owner: owner,
                repo: repository,
                issue_number: issueNumber,
                labels: labels,
            });
        };
        this.isIssue = async (owner, repository, issueNumber, token) => {
            const isPullRequest = await this.isPullRequest(owner, repository, issueNumber, token);
            return !isPullRequest;
        };
        this.isPullRequest = async (owner, repository, issueNumber, token) => {
            const octokit = github.getOctokit(token);
            const { data } = await octokit.rest.issues.get({
                owner: owner,
                repo: repository,
                issue_number: issueNumber,
            });
            return !!data.pull_request;
        };
        this.getHeadBranch = async (owner, repository, issueNumber, token) => {
            const isPr = await this.isPullRequest(owner, repository, issueNumber, token);
            if (!isPr) {
                return undefined;
            }
            const octokit = github.getOctokit(token);
            const pullRequest = await octokit.rest.pulls.get({
                owner,
                repo: repository,
                pull_number: issueNumber,
            });
            return pullRequest.data.head.ref;
        };
        this.addComment = async (owner, repository, issueNumber, comment, token) => {
            const octokit = github.getOctokit(token);
            await octokit.rest.issues.createComment({
                owner: owner,
                repo: repository,
                issue_number: issueNumber,
                body: comment,
            });
            (0, logger_1.logDebugInfo)(`Comment added to Issue ${issueNumber}.`);
        };
        this.updateComment = async (owner, repository, issueNumber, commentId, comment, token) => {
            const octokit = github.getOctokit(token);
            await octokit.rest.issues.updateComment({
                owner: owner,
                repo: repository,
                comment_id: commentId,
                body: comment,
            });
            (0, logger_1.logDebugInfo)(`Comment ${commentId} updated in Issue ${issueNumber}.`);
        };
        this.closeIssue = async (owner, repository, issueNumber, token) => {
            const octokit = github.getOctokit(token);
            const { data: issue } = await octokit.rest.issues.get({
                owner: owner,
                repo: repository,
                issue_number: issueNumber,
            });
            (0, logger_1.logDebugInfo)(`Issue #${issueNumber} state: ${issue.state}`);
            if (issue.state === 'open') {
                await octokit.rest.issues.update({
                    owner: owner,
                    repo: repository,
                    issue_number: issueNumber,
                    state: 'closed',
                });
                (0, logger_1.logDebugInfo)(`Issue #${issueNumber} has been closed.`);
                return true;
            }
            else {
                (0, logger_1.logDebugInfo)(`Issue #${issueNumber} is already closed.`);
                return false;
            }
        };
        this.openIssue = async (owner, repository, issueNumber, token) => {
            const octokit = github.getOctokit(token);
            const { data: issue } = await octokit.rest.issues.get({
                owner: owner,
                repo: repository,
                issue_number: issueNumber,
            });
            (0, logger_1.logDebugInfo)(`Issue #${issueNumber} state: ${issue.state}`);
            if (issue.state === 'closed') {
                await octokit.rest.issues.update({
                    owner: owner,
                    repo: repository,
                    issue_number: issueNumber,
                    state: 'open',
                });
                (0, logger_1.logDebugInfo)(`Issue #${issueNumber} has been re-opened.`);
                return true;
            }
            else {
                (0, logger_1.logDebugInfo)(`Issue #${issueNumber} is already opened.`);
                return false;
            }
        };
        this.getCurrentAssignees = async (owner, repository, issueNumber, token) => {
            const octokit = github.getOctokit(token);
            try {
                const { data: issue } = await octokit.rest.issues.get({
                    owner,
                    repo: repository,
                    issue_number: issueNumber,
                });
                const assignees = issue.assignees;
                if (assignees === undefined || assignees === null) {
                    return [];
                }
                return assignees.map((assignee) => assignee.login);
            }
            catch (error) {
                (0, logger_1.logError)(`Error getting members of issue: ${error}.`);
                return [];
            }
        };
        this.assignMembersToIssue = async (owner, repository, issueNumber, members, token) => {
            const octokit = github.getOctokit(token);
            try {
                if (members.length === 0) {
                    (0, logger_1.logDebugInfo)(`No members provided for assignment. Skipping operation.`);
                    return [];
                }
                const { data: updatedIssue } = await octokit.rest.issues.addAssignees({
                    owner,
                    repo: repository,
                    issue_number: issueNumber,
                    assignees: members,
                });
                const updatedAssignees = updatedIssue.assignees || [];
                return updatedAssignees.map((assignee) => assignee.login);
            }
            catch (error) {
                (0, logger_1.logError)(`Error assigning members to issue: ${error}.`);
                return [];
            }
        };
        this.getIssueDescription = async (owner, repository, issueNumber, token) => {
            const octokit = github.getOctokit(token);
            const { data: issue } = await octokit.rest.issues.get({
                owner,
                repo: repository,
                issue_number: issueNumber,
            });
            return issue.body ?? '';
        };
        this.setIssueType = async (owner, repository, issueNumber, labels, issueTypes, token) => {
            try {
                let issueType = issueTypes.task;
                if (labels.isHotfix) {
                    issueType = issueTypes.hotfix;
                }
                else if (labels.isRelease) {
                    issueType = issueTypes.release;
                }
                else if ((labels.isDocs || labels.isDocumentation)) {
                    issueType = issueTypes.documentation;
                }
                else if (labels.isChore || labels.isMaintenance) {
                    issueType = issueTypes.maintenance;
                }
                else if (labels.isBugfix || labels.isBug) {
                    issueType = issueTypes.bug;
                }
                else if (labels.isFeature || labels.isEnhancement) {
                    issueType = issueTypes.feature;
                }
                else if (labels.isHelp) {
                    issueType = issueTypes.help;
                }
                else if (labels.isQuestion) {
                    issueType = issueTypes.question;
                }
                const issueId = await this.getId(owner, repository, issueNumber, token);
                const octokit = github.getOctokit(token);
                (0, logger_1.logDebugInfo)(`Setting issue type for issue ${issueNumber} to ${issueType}`);
                const { organization } = await octokit.graphql(`
                query ($owner: String!) {
                    organization(login: $owner) {
                        id
                        issueTypes(first: 10) {
                            nodes {
                                id
                                name
                            }
                        }
                    }
                }
            `, { owner });
                const issueTypeData = organization.issueTypes.nodes.find(type => type.name.toLowerCase() === issueType.toLowerCase());
                let issueTypeId;
                if (!issueTypeData) {
                    (0, logger_1.logDebugInfo)(`Issue type "${issueType}" not found in organization ${owner}. Creating it...`);
                    // Create the issue type
                    const createIssueTypeResult = await octokit.graphql(`
                    mutation ($owner: String!, $name: String!) {
                        createIssueType(input: {organizationId: $owner, name: $name}) {
                            issueType {
                                id
                            }
                        }
                    }
                `, {
                        owner: organization.id,
                        name: issueType
                    });
                    issueTypeId = createIssueTypeResult.createIssueType.issueType.id;
                    (0, logger_1.logDebugInfo)(`Created new issue type "${issueType}" with ID: ${issueTypeId}`);
                }
                else {
                    issueTypeId = issueTypeData.id;
                }
                await octokit.graphql(`
                mutation ($issueId: ID!, $issueTypeId: ID!) {
                    updateIssueIssueType(input: {issueId: $issueId, issueTypeId: $issueTypeId}) {
                        issue {
                            id
                            issueType {
                                id
                                name
                            }
                        }
                    }
                }
            `, {
                    issueId,
                    issueTypeId,
                });
                (0, logger_1.logDebugInfo)(`Successfully updated issue type to ${issueType}`);
            }
            catch (error) {
                (0, logger_1.logError)(`Failed to update issue type: ${error}`);
                throw error;
            }
        };
    }
}
exports.IssueRepository = IssueRepository;
