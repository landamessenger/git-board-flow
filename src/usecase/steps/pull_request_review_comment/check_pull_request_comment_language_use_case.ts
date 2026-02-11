import { Execution } from "../../../data/model/execution";
import { Result } from "../../../data/model/result";
import {
    AiRepository,
    LANGUAGE_CHECK_RESPONSE_SCHEMA,
    OPENCODE_AGENT_PLAN,
    TRANSLATION_RESPONSE_SCHEMA,
} from "../../../data/repository/ai_repository";
import { IssueRepository } from "../../../data/repository/issue_repository";
import { logInfo } from "../../../utils/logger";
import { getTaskEmoji } from "../../../utils/task_emoji";
import { ParamUseCase } from "../../base/param_usecase";

export class CheckPullRequestCommentLanguageUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'CheckPullRequestCommentLanguageUseCase';

    private aiRepository = new AiRepository();
    private issueRepository = new IssueRepository();
    private translatedKey = `<!-- content_translated
If you'd like this comment to be translated again, please delete the entire comment, including this message. It will then be processed as a new one.
-->`;
    
    async invoke(param: Execution): Promise<Result[]> {
        logInfo(`${getTaskEmoji(this.taskId)} Executing ${this.taskId}.`)

        const results: Result[] = []

        const commentBody = param.pullRequest.commentBody;

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
        const checkResponse = await this.aiRepository.askAgent(
            param.ai,
            OPENCODE_AGENT_PLAN,
            prompt,
            {
                expectJson: true,
                schema: LANGUAGE_CHECK_RESPONSE_SCHEMA as unknown as Record<string, unknown>,
                schemaName: 'language_check_response',
            },
        );
        const status =
            checkResponse != null &&
            typeof checkResponse === 'object' &&
            typeof (checkResponse as Record<string, unknown>).status === 'string'
                ? ((checkResponse as Record<string, unknown>).status as string)
                : '';
        if (status === 'done') {
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
2. Put the translated text in the translatedText field
3. If you cannot translate (e.g. ambiguous or invalid input), set translatedText to empty string and explain in reason

The text to translate is: ${commentBody}
        `;
        const translationResponse = await this.aiRepository.askAgent(
            param.ai,
            OPENCODE_AGENT_PLAN,
            prompt,
            {
                expectJson: true,
                schema: TRANSLATION_RESPONSE_SCHEMA as unknown as Record<string, unknown>,
                schemaName: 'translation_response',
            },
        );

        const translatedText =
            translationResponse != null &&
            typeof translationResponse === 'object' &&
            typeof (translationResponse as Record<string, unknown>).translatedText === 'string'
                ? ((translationResponse as Record<string, unknown>).translatedText as string).trim()
                : '';

        if (!translatedText) {
            const reason =
                translationResponse != null &&
                typeof translationResponse === 'object' &&
                typeof (translationResponse as Record<string, unknown>).reason === 'string'
                    ? (translationResponse as Record<string, unknown>).reason
                    : undefined;
            logInfo(
                `Translation returned no text; skipping comment update.${reason ? ` Reason: ${reason}` : ' OpenCode may have failed or returned invalid response.'}`
            );
            results.push(
                new Result({
                    id: this.taskId,
                    success: true,
                    executed: false,
                })
            );
            return results;
        }

        const translatedCommentBody = `${translatedText}
> ${commentBody}
${this.translatedKey}
`;

        await this.issueRepository.updateComment(
            param.owner,
            param.repo,
            param.pullRequest.number,
            param.pullRequest.commentId,
            translatedCommentBody,
            param.tokens.token,
        );

        return results;
    }
}
