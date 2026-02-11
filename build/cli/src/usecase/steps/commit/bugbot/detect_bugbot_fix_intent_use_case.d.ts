import type { Execution } from "../../../../data/model/execution";
import { ParamUseCase } from "../../../base/param_usecase";
import { Result } from "../../../../data/model/result";
export interface BugbotFixIntent {
    isFixRequest: boolean;
    targetFindingIds: string[];
}
/**
 * Asks OpenCode (plan agent) whether the user comment is a request to fix one or more
 * bugbot findings, and which finding ids to target. Used from issue comments and PR
 * review comments. When isFixRequest is true and targetFindingIds is non-empty, the
 * caller (IssueCommentUseCase / PullRequestReviewCommentUseCase) runs the autofix flow.
 * Requires unresolved findings (from loadBugbotContext); otherwise we skip and return empty.
 */
export declare class DetectBugbotFixIntentUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string;
    private aiRepository;
    invoke(param: Execution): Promise<Result[]>;
}
