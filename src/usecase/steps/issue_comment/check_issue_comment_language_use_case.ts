import { Execution } from "../../../data/model/execution";
import { Result } from "../../../data/model/result";
import { AiRepository } from "../../../data/repository/ai_repository";
import { IssueRepository } from "../../../data/repository/issue_repository";
import { logInfo } from "../../../utils/logger";
import { ParamUseCase } from "../../base/param_usecase";

export class CheckIssueCommentLanguageUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'CheckIssueCommentLanguageUseCase';

    private aiRepository = new AiRepository();
    private issueRepository = new IssueRepository();
    private translatedKey = `<!-- content_translated
If you'd like this comment to be translated again, please delete the entire comment, including this message. It will then be processed as a new one.
-->`;
    
    async invoke(param: Execution): Promise<Result[]> {
        logInfo(`Executing ${this.taskId}.`)

        const results: Result[] = []

        const commentBody = param.issue.commentBody;

        if (commentBody.length === 0 || commentBody.includes(this.translatedKey)) {
            results.push(
                new Result({
                    id: this.taskId,
                    success: true,
                    executed: false,
                })
            );
            return results;
        }

        const locale = param.locale.issue;
        let prompt = `
        You are a helpful assistant that checks if the text is written in ${locale}.
        
        Instructions:
        1. Analyze the provided text
        2. If the text is written in ${locale}, respond with exactly "done"
        3. If the text is written in any other language, respond with exactly "must_translate"
        4. Do not provide any explanation or additional text
        
        The text is: ${commentBody}
        `;
        
        let result = await this.aiRepository.ask(
            param.ai,
            prompt,
        );
        
        if (result === "done") {
            results.push(
                new Result({
                    id: this.taskId,
                    success: true,
                    executed: true,
                })
            );
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
        result = await this.aiRepository.ask(
            param.ai,
            prompt,
        );

        const translatedCommentBody = `${result}
> ${commentBody}
${this.translatedKey}
`;

        logInfo(`🔎 Issue number: ${param.issue.number}`);
        await this.issueRepository.updateComment(
            param.owner,
            param.repo,
            param.issue.number,
            param.issue.commentId,
            translatedCommentBody,
            param.tokens.token,
        );

        return results;
    }
}