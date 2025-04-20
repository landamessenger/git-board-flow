"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IssueCommentUseCase = void 0;
const logger_1 = require("../utils/logger");
const ask_ai_use_case_1 = require("./steps/common/ask_ai_use_case");
const check_issue_comment_language_use_case_1 = require("./steps/issue_comment/check_issue_comment_language_use_case");
class IssueCommentUseCase {
    constructor() {
        this.taskId = 'IssueCommentUseCase';
    }
    async invoke(param) {
        (0, logger_1.logInfo)(`Executing ${this.taskId}.`);
        const results = [];
        results.push(...await new check_issue_comment_language_use_case_1.CheckIssueCommentLanguageUseCase().invoke(param));
        results.push(...await new ask_ai_use_case_1.AskActionUseCase().invoke(param));
        return results;
    }
}
exports.IssueCommentUseCase = IssueCommentUseCase;
