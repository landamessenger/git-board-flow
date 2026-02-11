import { Execution } from "../data/model/execution";
import { Result } from "../data/model/result";
import { logInfo } from "../utils/logger";
import { getTaskEmoji } from "../utils/task_emoji";
import { ParamUseCase } from "./base/param_usecase";
import { CheckPullRequestCommentLanguageUseCase } from "./steps/pull_request_review_comment/check_pull_request_comment_language_use_case";

export class PullRequestReviewCommentUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'PullRequestReviewCommentUseCase';

    async invoke(param: Execution): Promise<Result[]> {
        logInfo(`${getTaskEmoji(this.taskId)} Executing ${this.taskId}.`)

        const results: Result[] = []

        results.push(...await new CheckPullRequestCommentLanguageUseCase().invoke(param));

        return results;
    }
}