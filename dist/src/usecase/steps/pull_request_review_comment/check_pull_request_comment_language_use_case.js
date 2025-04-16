"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CheckPullRequestCommentLanguageUseCase = void 0;
const result_1 = require("../../../data/model/result");
const ai_repository_1 = require("../../../data/repository/ai_repository");
const issue_repository_1 = require("../../../data/repository/issue_repository");
const logger_1 = require("../../../utils/logger");
class CheckPullRequestCommentLanguageUseCase {
    constructor() {
        this.taskId = 'CheckPullRequestCommentLanguageUseCase';
        this.aiRepository = new ai_repository_1.AiRepository();
        this.issueRepository = new issue_repository_1.IssueRepository();
        this.translatedKey = `<!-- content_translated
If you'd like this comment to be translated again, please delete the entire comment, including this message. It will then be processed as a new one.
-->`;
    }
    async invoke(param) {
        (0, logger_1.logInfo)(`Executing ${this.taskId}.`);
        const results = [];
        const commentBody = param.pullRequest.commentBody;
        if (commentBody.length === 0 || commentBody.includes(this.translatedKey)) {
            results.push(new result_1.Result({
                id: this.taskId,
                success: true,
                executed: false,
            }));
            return results;
        }
        const locale = param.locale.pullRequest;
        let prompt = `
        You are a helpful assistant that checks if the text is written in ${locale}.
        
        Instructions:
        1. Analyze the provided text
        2. If the text is written in ${locale}, respond with exactly "done"
        3. If the text is written in any other language, respond with exactly "must_translate"
        4. Do not provide any explanation or additional text
        
        The text is: ${commentBody}
        `;
        let result = await this.aiRepository.ask(param.ai, prompt);
        if (result === "done") {
            results.push(new result_1.Result({
                id: this.taskId,
                success: true,
                executed: true,
            }));
            return results;
        }
        prompt = `
You are a helpful assistant that translates the text to ${locale}.

Instructions:
1. Translate the text to ${locale}
2. Do not provide any explanation or additional text
3. Return the translated text only

The text is: ${commentBody}
        `;
        result = await this.aiRepository.ask(param.ai, prompt);
        const translatedCommentBody = `${result}
> ${commentBody}
${this.translatedKey}
`;
        await this.issueRepository.updateComment(param.owner, param.repo, param.pullRequest.number, param.pullRequest.commentId, translatedCommentBody, param.tokens.token);
        return results;
    }
}
exports.CheckPullRequestCommentLanguageUseCase = CheckPullRequestCommentLanguageUseCase;
