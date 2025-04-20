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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mainRun = mainRun;
const core = __importStar(require("@actions/core"));
const commit_use_case_1 = require("../usecase/commit_use_case");
const issue_comment_use_case_1 = require("../usecase/issue_comment_use_case");
const issue_use_case_1 = require("../usecase/issue_use_case");
const pull_request_review_comment_use_case_1 = require("../usecase/pull_request_review_comment_use_case");
const pull_request_use_case_1 = require("../usecase/pull_request_use_case");
const single_action_use_case_1 = require("../usecase/single_action_use_case");
const logger_1 = require("../utils/logger");
const constants_1 = require("../utils/constants");
const chalk_1 = __importDefault(require("chalk"));
const boxen_1 = __importDefault(require("boxen"));
async function mainRun(execution) {
    await execution.setup();
    if (execution.runnedByToken) {
        (0, logger_1.logInfo)(`User from token (${execution.tokenUser}) matches actor. Ignoring.`);
        return [];
    }
    if (execution.issueNumber === -1) {
        (0, logger_1.logInfo)(`Issue number not found. Skipping.`);
        return [];
    }
    if (execution.welcome) {
        (0, logger_1.logInfo)((0, boxen_1.default)(chalk_1.default.cyan(execution.welcome.title) +
            execution.welcome.messages.map(message => chalk_1.default.gray(message)).join('\n'), {
            padding: 1,
            margin: 1,
            borderStyle: 'round',
            borderColor: 'cyan',
            title: constants_1.TITLE,
            titleAlignment: 'center'
        }));
    }
    const results = [];
    try {
        if (execution.isSingleAction) {
            results.push(...await new single_action_use_case_1.SingleActionUseCase().invoke(execution));
        }
        else if (execution.isIssue) {
            if (execution.issue.isIssueComment) {
                results.push(...await new issue_comment_use_case_1.IssueCommentUseCase().invoke(execution));
            }
            else {
                results.push(...await new issue_use_case_1.IssueUseCase().invoke(execution));
            }
        }
        else if (execution.isPullRequest) {
            if (execution.pullRequest.isPullRequestReviewComment) {
                results.push(...await new pull_request_review_comment_use_case_1.PullRequestReviewCommentUseCase().invoke(execution));
            }
            else {
                results.push(...await new pull_request_use_case_1.PullRequestUseCase().invoke(execution));
            }
        }
        else if (execution.isPush) {
            results.push(...await new commit_use_case_1.CommitUseCase().invoke(execution));
        }
        else {
            core.setFailed(`Action not handled.`);
        }
        return results;
    }
    catch (error) {
        core.setFailed(error.message);
        return [];
    }
}
