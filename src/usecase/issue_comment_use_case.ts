import { Execution } from "../data/model/execution";
import { Result } from "../data/model/result";
import { logInfo } from "../utils/logger";
import { getTaskEmoji } from "../utils/task_emoji";
import { ThinkUseCase } from "./steps/common/think_use_case";
import { ParamUseCase } from "./base/param_usecase";
import { CheckIssueCommentLanguageUseCase } from "./steps/issue_comment/check_issue_comment_language_use_case";

export class IssueCommentUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'IssueCommentUseCase';

    async invoke(param: Execution): Promise<Result[]> {
        logInfo(`${getTaskEmoji(this.taskId)} Executing ${this.taskId}.`)

        const results: Result[] = []

        results.push(...await new CheckIssueCommentLanguageUseCase().invoke(param));

        results.push(...await new ThinkUseCase().invoke(param));
        

        return results;
    }
}