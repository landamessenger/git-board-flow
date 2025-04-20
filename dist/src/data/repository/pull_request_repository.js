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
exports.PullRequestRepository = void 0;
const github = __importStar(require("@actions/github"));
const logger_1 = require("../../utils/logger");
class PullRequestRepository {
    constructor() {
        this.isLinked = async (pullRequestUrl) => {
            const htmlContent = await fetch(pullRequestUrl).then(res => res.text());
            return !htmlContent.includes('has_github_issues=false');
        };
        this.updateBaseBranch = async (owner, repository, pullRequestNumber, branch, token) => {
            const octokit = github.getOctokit(token);
            await octokit.rest.pulls.update({
                owner: owner,
                repo: repository,
                pull_number: pullRequestNumber,
                base: branch,
            });
            (0, logger_1.logDebugInfo)(`Changed base branch to ${branch}`);
        };
        this.updateDescription = async (owner, repository, pullRequestNumber, description, token) => {
            const octokit = github.getOctokit(token);
            await octokit.rest.pulls.update({
                owner: owner,
                repo: repository,
                pull_number: pullRequestNumber,
                body: description,
            });
            (0, logger_1.logDebugInfo)(`Updated PR #${pullRequestNumber} description with: ${description}`);
        };
        this.getCurrentReviewers = async (owner, repository, pullNumber, token) => {
            const octokit = github.getOctokit(token);
            try {
                const { data } = await octokit.rest.pulls.listRequestedReviewers({
                    owner,
                    repo: repository,
                    pull_number: pullNumber,
                });
                return data.users.map((user) => user.login);
            }
            catch (error) {
                (0, logger_1.logError)(`Error getting reviewers of PR: ${error}.`);
                return [];
            }
        };
        this.addReviewersToPullRequest = async (owner, repository, pullNumber, reviewers, token) => {
            const octokit = github.getOctokit(token);
            try {
                if (reviewers.length === 0) {
                    (0, logger_1.logDebugInfo)(`No reviewers provided for addition. Skipping operation.`);
                    return [];
                }
                const { data } = await octokit.rest.pulls.requestReviewers({
                    owner,
                    repo: repository,
                    pull_number: pullNumber,
                    reviewers: reviewers,
                });
                const addedReviewers = data.requested_reviewers || [];
                return addedReviewers.map((reviewer) => reviewer.login);
            }
            catch (error) {
                (0, logger_1.logError)(`Error adding reviewers to pull request: ${error}.`);
                return [];
            }
        };
        this.getChangedFiles = async (owner, repository, pullNumber, token) => {
            const octokit = github.getOctokit(token);
            try {
                const { data } = await octokit.rest.pulls.listFiles({
                    owner,
                    repo: repository,
                    pull_number: pullNumber,
                });
                return data.map((file) => ({
                    filename: file.filename,
                    status: file.status
                }));
            }
            catch (error) {
                (0, logger_1.logError)(`Error getting changed files from pull request: ${error}.`);
                return [];
            }
        };
        this.getPullRequestChanges = async (owner, repository, pullNumber, token) => {
            const octokit = github.getOctokit(token);
            try {
                const { data: filesData } = await octokit.rest.pulls.listFiles({
                    owner,
                    repo: repository,
                    pull_number: pullNumber,
                });
                return filesData.map((file) => ({
                    filename: file.filename,
                    status: file.status,
                    additions: file.additions,
                    deletions: file.deletions,
                    patch: file.patch || ''
                }));
            }
            catch (error) {
                (0, logger_1.logError)(`Error getting pull request changes: ${error}.`);
                return [];
            }
        };
    }
}
exports.PullRequestRepository = PullRequestRepository;
