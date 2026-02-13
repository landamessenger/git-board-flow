/**
 * Prompts for checking if a comment is in the target locale and for translating it.
 * Used by CheckIssueCommentLanguageUseCase and CheckPullRequestCommentLanguageUseCase.
 */
import { fillTemplate } from './fill';

const CHECK_TEMPLATE = `
        You are a helpful assistant that checks if the text is written in {{locale}}.
        
        Instructions:
        1. Analyze the provided text
        2. If the text is written in {{locale}}, respond with exactly "done"
        3. If the text is written in any other language, respond with exactly "must_translate"
        4. Do not provide any explanation or additional text
        
        The text is: {{commentBody}}
        `;

const TRANSLATE_TEMPLATE = `
You are a helpful assistant that translates the text to {{locale}}.

Instructions:
1. Translate the text to {{locale}}
2. Put the translated text in the translatedText field
3. If you cannot translate (e.g. ambiguous or invalid input), set translatedText to empty string and explain in reason

The text to translate is: {{commentBody}}
        `;

export type CheckCommentLanguageParams = {
    locale: string;
    commentBody: string;
};

export function getCheckCommentLanguagePrompt(params: CheckCommentLanguageParams): string {
    return fillTemplate(CHECK_TEMPLATE.trim(), {
        locale: params.locale,
        commentBody: params.commentBody,
    });
}

export function getTranslateCommentPrompt(params: CheckCommentLanguageParams): string {
    return fillTemplate(TRANSLATE_TEMPLATE.trim(), {
        locale: params.locale,
        commentBody: params.commentBody,
    });
}
