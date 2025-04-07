import { Execution } from "../data/model/execution";
import { Result } from "../data/model/result";
import { logInfo } from "../utils/logger";
import { ParamUseCase } from "./base/param_usecase";
import { CheckIssueCommentLanguageUseCase } from "./steps/issue_comment/check_issue_comment_language_use_case";
export class IssueCommentUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'IssueCommentUseCase';

    async invoke(param: Execution): Promise<Result[]> {
        logInfo(`Executing ${this.taskId}.`)

        const results: Result[] = []

        results.push(...await new CheckIssueCommentLanguageUseCase().invoke(param));

        return results;
    }
}