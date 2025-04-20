"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PullRequestReviewCommentUseCase = void 0;
const logger_1 = require("../utils/logger");
const check_pull_request_comment_language_use_case_1 = require("./steps/pull_request_review_comment/check_pull_request_comment_language_use_case");
class PullRequestReviewCommentUseCase {
    constructor() {
        this.taskId = 'PullRequestReviewCommentUseCase';
    }
    async invoke(param) {
        (0, logger_1.logInfo)(`Executing ${this.taskId}.`);
        const results = [];
        results.push(...await new check_pull_request_comment_language_use_case_1.CheckPullRequestCommentLanguageUseCase().invoke(param));
        return results;
    }
}
exports.PullRequestReviewCommentUseCase = PullRequestReviewCommentUseCase;
