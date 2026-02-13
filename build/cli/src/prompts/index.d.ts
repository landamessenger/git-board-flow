import type { AnswerIssueHelpParams } from './answer_issue_help';
import type { ThinkParams } from './think';
import type { UpdatePullRequestDescriptionParams } from './update_pull_request_description';
import type { UserRequestParams } from './user_request';
import type { RecommendStepsParams } from './recommend_steps';
import type { CheckProgressParams } from './check_progress';
import type { CheckCommentLanguageParams } from './check_comment_language';
import type { CliDoParams } from './cli_do';
import type { BugbotParams } from './bugbot';
import type { BugbotFixParams } from './bugbot_fix';
import type { BugbotFixIntentParams } from './bugbot_fix_intent';
export { fillTemplate } from './fill';
export { getAnswerIssueHelpPrompt } from './answer_issue_help';
export type { AnswerIssueHelpParams } from './answer_issue_help';
export { getThinkPrompt } from './think';
export type { ThinkParams } from './think';
export { getUpdatePullRequestDescriptionPrompt } from './update_pull_request_description';
export type { UpdatePullRequestDescriptionParams } from './update_pull_request_description';
export { getUserRequestPrompt } from './user_request';
export type { UserRequestParams } from './user_request';
export { getRecommendStepsPrompt } from './recommend_steps';
export type { RecommendStepsParams } from './recommend_steps';
export { getCheckProgressPrompt } from './check_progress';
export type { CheckProgressParams } from './check_progress';
export { getCheckCommentLanguagePrompt, getTranslateCommentPrompt, } from './check_comment_language';
export type { CheckCommentLanguageParams } from './check_comment_language';
export { getCliDoPrompt } from './cli_do';
export type { CliDoParams } from './cli_do';
export { getBugbotPrompt } from './bugbot';
export type { BugbotParams } from './bugbot';
export { getBugbotFixPrompt } from './bugbot_fix';
export type { BugbotFixParams } from './bugbot_fix';
export { getBugbotFixIntentPrompt } from './bugbot_fix_intent';
export type { BugbotFixIntentParams } from './bugbot_fix_intent';
/** Known prompt names for getPrompt() */
export declare const PROMPT_NAMES: {
    readonly ANSWER_ISSUE_HELP: "answer_issue_help";
    readonly THINK: "think";
    readonly UPDATE_PULL_REQUEST_DESCRIPTION: "update_pull_request_description";
    readonly USER_REQUEST: "user_request";
    readonly RECOMMEND_STEPS: "recommend_steps";
    readonly CHECK_PROGRESS: "check_progress";
    readonly CHECK_COMMENT_LANGUAGE: "check_comment_language";
    readonly TRANSLATE_COMMENT: "translate_comment";
    readonly CLI_DO: "cli_do";
    readonly BUGBOT: "bugbot";
    readonly BUGBOT_FIX: "bugbot_fix";
    readonly BUGBOT_FIX_INTENT: "bugbot_fix_intent";
};
export type PromptName = (typeof PROMPT_NAMES)[keyof typeof PROMPT_NAMES];
type PromptParamsMap = {
    [PROMPT_NAMES.ANSWER_ISSUE_HELP]: AnswerIssueHelpParams;
    [PROMPT_NAMES.THINK]: ThinkParams;
    [PROMPT_NAMES.UPDATE_PULL_REQUEST_DESCRIPTION]: UpdatePullRequestDescriptionParams;
    [PROMPT_NAMES.USER_REQUEST]: UserRequestParams;
    [PROMPT_NAMES.RECOMMEND_STEPS]: RecommendStepsParams;
    [PROMPT_NAMES.CHECK_PROGRESS]: CheckProgressParams;
    [PROMPT_NAMES.CHECK_COMMENT_LANGUAGE]: CheckCommentLanguageParams;
    [PROMPT_NAMES.TRANSLATE_COMMENT]: CheckCommentLanguageParams;
    [PROMPT_NAMES.CLI_DO]: CliDoParams;
    [PROMPT_NAMES.BUGBOT]: BugbotParams;
    [PROMPT_NAMES.BUGBOT_FIX]: BugbotFixParams;
    [PROMPT_NAMES.BUGBOT_FIX_INTENT]: BugbotFixIntentParams;
};
/**
 * Returns a filled prompt by name. Params must match the prompt's expected keys.
 */
export declare function getPrompt(name: PromptName, params: PromptParamsMap[PromptName]): string;
