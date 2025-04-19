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
exports.LinkPullRequestIssueUseCase = void 0;
const github = __importStar(require("@actions/github"));
const result_1 = require("../../../data/model/result");
const pull_request_repository_1 = require("../../../data/repository/pull_request_repository");
const logger_1 = require("../../../utils/logger");
class LinkPullRequestIssueUseCase {
    constructor() {
        this.taskId = 'LinkPullRequestIssueUseCase';
        this.pullRequestRepository = new pull_request_repository_1.PullRequestRepository();
    }
    async invoke(param) {
        (0, logger_1.logInfo)(`Executing ${this.taskId}.`);
        const result = [];
        try {
            const isLinked = await this.pullRequestRepository.isLinked(github.context.payload.pull_request?.html_url ?? '');
            if (!isLinked) {
                /**
                 *  Set the primary/default branch
                 */
                await this.pullRequestRepository.updateBaseBranch(param.owner, param.repo, param.pullRequest.number, param.branches.defaultBranch, param.tokens.token);
                result.push(new result_1.Result({
                    id: this.taskId,
                    success: true,
                    executed: true,
                    steps: [
                        `The base branch was temporarily updated to \`${param.branches.defaultBranch}\`.`,
                    ],
                }));
                /**
                 *  Update PR's description.
                 */
                let prBody = param.pullRequest.body;
                let updatedBody = `${prBody}\n\nResolves #${param.issueNumber}`;
                await this.pullRequestRepository.updateDescription(param.owner, param.repo, param.pullRequest.number, updatedBody, param.tokens.token);
                result.push(new result_1.Result({
                    id: this.taskId,
                    success: true,
                    executed: true,
                    steps: [
                        `The description was temporarily modified to include a reference to issue **#${param.issueNumber}**.`,
                    ],
                }));
                /**
                 *  Await 20 seconds
                 */
                await new Promise(resolve => setTimeout(resolve, 20 * 1000));
                /**
                 *  Restore the original branch
                 */
                await this.pullRequestRepository.updateBaseBranch(param.owner, param.repo, param.pullRequest.number, param.pullRequest.base, param.tokens.token);
                result.push(new result_1.Result({
                    id: this.taskId,
                    success: true,
                    executed: true,
                    steps: [
                        `The base branch was reverted to its original value: \`${param.pullRequest.base}\`.`,
                    ],
                }));
                /**
                 * Restore comment on description
                 */
                prBody = param.pullRequest.body;
                updatedBody = prBody.replace(`\n\nResolves #${param.issueNumber}`, "");
                await this.pullRequestRepository.updateDescription(param.owner, param.repo, param.pullRequest.number, updatedBody, param.tokens.token);
                result.push(new result_1.Result({
                    id: this.taskId,
                    success: true,
                    executed: true,
                    steps: [
                        `The temporary issue reference **#${param.issueNumber}** was removed from the description.`,
                    ],
                }));
                return result;
            }
        }
        catch (error) {
            (0, logger_1.logError)(error);
            result.push(new result_1.Result({
                id: this.taskId,
                success: false,
                executed: true,
                steps: [
                    `Tried to link pull request to project, but there was a problem.`,
                ],
                error: error,
            }));
        }
        return result;
    }
}
exports.LinkPullRequestIssueUseCase = LinkPullRequestIssueUseCase;
