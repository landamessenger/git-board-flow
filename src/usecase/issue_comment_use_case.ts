import { Execution } from "../data/model/execution";
import { Result } from "../data/model/result";
import { logInfo } from "../utils/logger";
import { AskActionUseCase } from "./steps/common/ask_ai_use_case";
import { ParamUseCase } from "./base/param_usecase";
import { CheckIssueCommentLanguageUseCase } from "./steps/issue_comment/check_issue_comment_language_use_case";

export class IssueCommentUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'IssueCommentUseCase';

    async invoke(param: Execution): Promise<Result[]> {
        logInfo(`Executing ${this.taskId}.`)

        const results: Result[] = []

        results.push(...await new CheckIssueCommentLanguageUseCase().invoke(param));

        results.push(...await new AskActionUseCase().invoke(param));
        

        return results;
    }
}