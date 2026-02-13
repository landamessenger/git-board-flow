export type CheckCommentLanguageParams = {
    locale: string;
    commentBody: string;
};
export declare function getCheckCommentLanguagePrompt(params: CheckCommentLanguageParams): string;
export declare function getTranslateCommentPrompt(params: CheckCommentLanguageParams): string;
