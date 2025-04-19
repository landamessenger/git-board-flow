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
exports.ProjectRepository = void 0;
const github = __importStar(require("@actions/github"));
const logger_1 = require("../../utils/logger");
const project_detail_1 = require("../model/project_detail");
class ProjectRepository {
    constructor() {
        this.priorityLabel = "Priority";
        this.sizeLabel = "Size";
        this.statusLabel = "Status";
        /**
         * Retrieves detailed information about a GitHub project
         * @param projectId - The project number/ID
         * @param token - GitHub authentication token
         * @returns Promise<ProjectDetail> - The project details
         * @throws {Error} If the project is not found or if there are authentication/network issues
         */
        this.getProjectDetail = async (projectId, token) => {
            try {
                // Validate projectId is a valid number
                const projectNumber = parseInt(projectId, 10);
                if (isNaN(projectNumber)) {
                    throw new Error(`Invalid project ID: ${projectId}. Must be a valid number.`);
                }
                const octokit = github.getOctokit(token);
                const { data: owner } = await octokit.rest.users.getByUsername({
                    username: github.context.repo.owner
                }).catch(error => {
                    throw new Error(`Failed to get owner information: ${error.message}`);
                });
                const ownerType = owner.type === 'Organization' ? 'orgs' : 'users';
                const projectUrl = `https://github.com/${ownerType}/${github.context.repo.owner}/projects/${projectId}`;
                const ownerQueryField = ownerType === 'orgs' ? 'organization' : 'user';
                const queryProject = `
                query($ownerName: String!, $projectNumber: Int!) {
                    ${ownerQueryField}(login: $ownerName) {
                        projectV2(number: $projectNumber) {
                            id
                            title
                            url
                        }
                    }
                }
            `;
                const projectResult = await octokit.graphql(queryProject, {
                    ownerName: github.context.repo.owner,
                    projectNumber: projectNumber,
                }).catch(error => {
                    throw new Error(`Failed to fetch project data: ${error.message}`);
                });
                const projectData = projectResult[ownerQueryField]?.projectV2;
                if (!projectData) {
                    throw new Error(`Project not found: ${projectUrl}`);
                }
                (0, logger_1.logDebugInfo)(`Project ID: ${projectData.id}`);
                (0, logger_1.logDebugInfo)(`Project Title: ${projectData.title}`);
                (0, logger_1.logDebugInfo)(`Project URL: ${projectData.url}`);
                return new project_detail_1.ProjectDetail({
                    id: projectData.id,
                    title: projectData.title,
                    url: projectData.url,
                    type: ownerQueryField,
                    owner: github.context.repo.owner,
                    number: projectNumber,
                });
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                (0, logger_1.logError)(`Error in getProjectDetail: ${errorMessage}`);
                throw error;
            }
        };
        this.getContentId = async (project, owner, repo, issueOrPullRequestNumber, token) => {
            const octokit = github.getOctokit(token);
            // Search for the issue or pull request ID in the repository
            const issueOrPrQuery = `
      query($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          issueOrPullRequest: issueOrPullRequest(number: $number) {
            ... on Issue {
              id
            }
            ... on PullRequest {
              id
            }
          }
        }
      }`;
            const issueOrPrResult = await octokit.graphql(issueOrPrQuery, {
                owner,
                repo,
                number: issueOrPullRequestNumber
            });
            if (!issueOrPrResult.repository.issueOrPullRequest) {
                console.error(`Issue or PR #${issueOrPullRequestNumber} not found.`);
                return undefined;
            }
            const contentId = issueOrPrResult.repository.issueOrPullRequest.id;
            // Search for the item ID in the project with pagination
            let cursor = null;
            let projectItemId = undefined;
            do {
                const projectQuery = `
        query($projectId: ID!, $cursor: String) {
          node(id: $projectId) {
            ... on ProjectV2 {
              items(first: 100, after: $cursor) {
                pageInfo {
                  hasNextPage
                  endCursor
                }
                nodes {
                  id
                  content {
                    ... on Issue {
                      id
                    }
                    ... on PullRequest {
                      id
                    }
                  }
                }
              }
            }
          }
        }`;
                const projectResult = await octokit.graphql(projectQuery, {
                    projectId: project.id,
                    cursor
                });
                const items = projectResult.node.items.nodes;
                const foundItem = items.find((item) => item.content?.id === contentId);
                if (foundItem) {
                    projectItemId = foundItem.id;
                    break;
                }
                cursor = projectResult.node.items.pageInfo.hasNextPage
                    ? projectResult.node.items.pageInfo.endCursor
                    : null;
            } while (cursor);
            return projectItemId;
        };
        this.isContentLinked = async (project, contentId, token) => {
            const octokit = github.getOctokit(token);
            let hasNextPage = true;
            let endCursor = null;
            let allItems = [];
            while (hasNextPage) {
                const query = `
    query($projectId: ID!, $after: String) {
      node(id: $projectId) {
        ... on ProjectV2 {
          items(first: 100, after: $after) {
            nodes {
              content {
                ... on PullRequest {
                  id
                }
                ... on Issue {
                  id
                }
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      }
    }
  `;
                (0, logger_1.logDebugInfo)(`Query: ${query}`);
                (0, logger_1.logDebugInfo)(`Project ID: ${project.id}`);
                (0, logger_1.logDebugInfo)(`Content ID: ${contentId}`);
                (0, logger_1.logDebugInfo)(`After cursor: ${endCursor}`);
                const result = await octokit.graphql(query, {
                    projectId: project.id,
                    after: endCursor,
                });
                (0, logger_1.logDebugInfo)(`Result: ${JSON.stringify(result, null, 2)}`);
                const items = result.node.items.nodes;
                allItems = allItems.concat(items);
                hasNextPage = result.node.items.pageInfo.hasNextPage;
                endCursor = result.node.items.pageInfo.endCursor;
            }
            return allItems.some((item) => item.content && item.content.id === contentId);
        };
        this.linkContentId = async (project, contentId, token) => {
            const alreadyLinked = await this.isContentLinked(project, contentId, token);
            if (alreadyLinked) {
                (0, logger_1.logDebugInfo)(`Content ${contentId} is already linked to project ${project.id}.`);
                return false;
            }
            const octokit = github.getOctokit(token);
            const linkMutation = `
          mutation($projectId: ID!, $contentId: ID!) {
            addProjectV2ItemById(input: {projectId: $projectId, contentId: $contentId}) {
              item {
                id
              }
            }
          }
        `;
            const linkResult = await octokit.graphql(linkMutation, {
                projectId: project.id,
                contentId: contentId,
            });
            (0, logger_1.logDebugInfo)(`Linked ${contentId} with id ${linkResult.addProjectV2ItemById.item.id} to project ${project.id}`);
            return true;
        };
        this.setSingleSelectFieldValue = async (project, owner, repo, issueOrPullRequestNumber, fieldName, fieldValue, token) => {
            const contentId = await this.getContentId(project, owner, repo, issueOrPullRequestNumber, token);
            if (!contentId) {
                (0, logger_1.logError)(`Content ID not found for issue or pull request #${issueOrPullRequestNumber}.`);
                return false;
            }
            (0, logger_1.logDebugInfo)(`Content ID: ${contentId}`);
            const octokit = github.getOctokit(token);
            // Get the field ID and current value
            const fieldQuery = `
        query($projectId: ID!, $after: String) {
          node(id: $projectId) {
            ... on ProjectV2 {
              fields(first: 20) {
                nodes { 
                  ... on ProjectV2SingleSelectField {
                    id
                    name
                    options {
                      id
                      name  
                    }
                  }
                }
              }
              items(first: 100, after: $after) {
                pageInfo {
                  hasNextPage
                  endCursor
                }
                nodes {
                  id
                  fieldValues(first: 20) {
                    nodes {
                      ... on ProjectV2ItemFieldSingleSelectValue {
                        field {
                          ... on ProjectV2SingleSelectField {
                            name
                          }
                        }
                        optionId
                      }
                    }
                  }
                }
              }
            }
          }         
        }`;
            let hasNextPage = true;
            let endCursor = null;
            let currentItem = null;
            // Get the field and option information from the first page
            const initialFieldResult = await octokit.graphql(fieldQuery, {
                projectId: project.id,
                after: null
            });
            const targetField = initialFieldResult.node.fields.nodes.find((f) => f.name === fieldName);
            (0, logger_1.logDebugInfo)(`Target field: ${JSON.stringify(targetField, null, 2)}`);
            if (!targetField) {
                (0, logger_1.logError)(`Field '${fieldName}' not found or is not a single-select field.`);
                return false;
            }
            const targetOption = targetField.options.find((opt) => opt.name === fieldValue);
            (0, logger_1.logDebugInfo)(`Target option: ${JSON.stringify(targetOption, null, 2)}`);
            if (!targetOption) {
                (0, logger_1.logError)(`Option '${fieldValue}' not found for field '${fieldName}'.`);
                return false;
            }
            // Now search for the item through all pages
            while (hasNextPage) {
                const fieldResult = await octokit.graphql(fieldQuery, {
                    projectId: project.id,
                    after: endCursor
                });
                (0, logger_1.logDebugInfo)(`Field result: ${JSON.stringify(fieldResult, null, 2)}`);
                // Check current value in current page
                currentItem = fieldResult.node.items.nodes.find((item) => item.id === contentId);
                if (currentItem) {
                    (0, logger_1.logDebugInfo)(`Current item: ${JSON.stringify(currentItem, null, 2)}`);
                    const currentFieldValue = currentItem.fieldValues.nodes.find((value) => value.field?.name === fieldName);
                    if (currentFieldValue && currentFieldValue.optionId === targetOption.id) {
                        (0, logger_1.logDebugInfo)(`Field '${fieldName}' is already set to '${fieldValue}'. No update needed.`);
                        return false;
                    }
                    break; // Found the item, no need to continue pagination
                }
                hasNextPage = fieldResult.node.items.pageInfo.hasNextPage;
                endCursor = fieldResult.node.items.pageInfo.endCursor;
            }
            (0, logger_1.logDebugInfo)(`Target field ID: ${targetField.id}`);
            (0, logger_1.logDebugInfo)(`Target option ID: ${targetOption.id}`);
            const mutation = `
        mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
          updateProjectV2ItemFieldValue(  
            input: {
              projectId: $projectId,
              itemId: $itemId,
              fieldId: $fieldId,
              value: { singleSelectOptionId: $optionId }
            }
          ) {
            projectV2Item {
              id
            }
          }
        }`;
            const mutationResult = await octokit.graphql(mutation, {
                projectId: project.id,
                itemId: contentId,
                fieldId: targetField.id,
                optionId: targetOption.id
            });
            return !!mutationResult.updateProjectV2ItemFieldValue.projectV2Item;
        };
        this.setTaskPriority = async (project, owner, repo, issueOrPullRequestNumber, priorityLabel, token) => this.setSingleSelectFieldValue(project, owner, repo, issueOrPullRequestNumber, this.priorityLabel, priorityLabel, token);
        this.setTaskSize = async (project, owner, repo, issueOrPullRequestNumber, sizeLabel, token) => this.setSingleSelectFieldValue(project, owner, repo, issueOrPullRequestNumber, this.sizeLabel, sizeLabel, token);
        this.moveIssueToColumn = async (project, owner, repo, issueOrPullRequestNumber, columnName, token) => this.setSingleSelectFieldValue(project, owner, repo, issueOrPullRequestNumber, this.statusLabel, columnName, token);
        this.getRandomMembers = async (organization, membersToAdd, currentMembers, token) => {
            if (membersToAdd === 0) {
                return [];
            }
            const octokit = github.getOctokit(token);
            try {
                const { data: teams } = await octokit.rest.teams.list({
                    org: organization,
                });
                if (teams.length === 0) {
                    (0, logger_1.logDebugInfo)(`${organization} doesn't have any team.`);
                    return [];
                }
                const membersSet = new Set();
                for (const team of teams) {
                    const { data: members } = await octokit.rest.teams.listMembersInOrg({
                        org: organization,
                        team_slug: team.slug,
                    });
                    members.forEach((member) => membersSet.add(member.login));
                }
                const allMembers = Array.from(membersSet);
                const availableMembers = allMembers.filter((member) => !currentMembers.includes(member));
                if (availableMembers.length === 0) {
                    (0, logger_1.logDebugInfo)(`No available members to assign for organization ${organization}.`);
                    return [];
                }
                if (membersToAdd >= availableMembers.length) {
                    (0, logger_1.logDebugInfo)(`Requested size (${membersToAdd}) exceeds available members (${availableMembers.length}). Returning all available members.`);
                    return availableMembers;
                }
                const shuffled = availableMembers.sort(() => Math.random() - 0.5);
                return shuffled.slice(0, membersToAdd);
            }
            catch (error) {
                (0, logger_1.logError)(`Error getting random members: ${error}.`);
            }
            return [];
        };
        this.getAllMembers = async (organization, token) => {
            const octokit = github.getOctokit(token);
            try {
                const { data: teams } = await octokit.rest.teams.list({
                    org: organization,
                });
                if (teams.length === 0) {
                    (0, logger_1.logDebugInfo)(`${organization} doesn't have any team.`);
                    return [];
                }
                const membersSet = new Set();
                for (const team of teams) {
                    const { data: members } = await octokit.rest.teams.listMembersInOrg({
                        org: organization,
                        team_slug: team.slug,
                    });
                    members.forEach((member) => membersSet.add(member.login));
                }
                return Array.from(membersSet);
            }
            catch (error) {
                (0, logger_1.logError)(`Error getting all members: ${error}.`);
            }
            return [];
        };
        this.getUserFromToken = async (token) => {
            const octokit = github.getOctokit(token);
            const { data: user } = await octokit.rest.users.getAuthenticated();
            return user.login;
        };
    }
}
exports.ProjectRepository = ProjectRepository;
