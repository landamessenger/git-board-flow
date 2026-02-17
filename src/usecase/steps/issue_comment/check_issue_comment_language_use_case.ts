import { Execution } from "../../../data/model/execution";
import { Result } from "../../../data/model/result";
import {
    AiRepository,
    LANGUAGE_CHECK_RESPONSE_SCHEMA,
    OPENCODE_AGENT_PLAN,
    TRANSLATION_RESPONSE_SCHEMA,
} from "../../../data/repository/ai_repository";
import { IssueRepository } from "../../../data/repository/issue_repository";
import { getCheckCommentLanguagePrompt, getTranslateCommentPrompt } from "../../../prompts";
import { logDebugInfo, logInfo } from "../../../utils/logger";
import { getTaskEmoji } from "../../../utils/task_emoji";
import { ParamUseCase } from "../../base/param_usecase";

export class CheckIssueCommentLanguageUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'CheckIssueCommentLanguageUseCase';

    private aiRepository = new AiRepository();
    private issueRepository = new IssueRepository();
    private translatedKey = `<!-- content_translated
If you'd like this comment to be translated again, please delete the entire comment, including this message. It will then be processed as a new one.
-->`;
    
    async invoke(param: Execution): Promise<Result[]> {
        logInfo(`${getTaskEmoji(this.taskId)} Executing ${this.taskId}.`)

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
        let prompt = getCheckCommentLanguagePrompt({ locale, commentBody });
        logDebugInfo(`CheckIssueCommentLanguage: locale=${locale}, comment length=${commentBody.length}. Calling OpenCode for language check.`);
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
        logDebugInfo(`CheckIssueCommentLanguage: language check status=${status}.`);
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

        prompt = getTranslateCommentPrompt({ locale, commentBody });
        logDebugInfo(`CheckIssueCommentLanguage: translating comment (prompt length=${prompt.length}).`);
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

        logDebugInfo(`CheckIssueCommentLanguage: translation received. translatedText length=${translatedText.length}. Full translated text:\n${translatedText}`);

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