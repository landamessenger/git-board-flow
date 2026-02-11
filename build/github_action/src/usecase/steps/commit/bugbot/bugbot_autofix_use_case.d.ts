import type { Execution } from "../../../../data/model/execution";
import { ParamUseCase } from "../../../base/param_usecase";
import { Result } from "../../../../data/model/result";
import type { BugbotContext } from "./types";
export interface BugbotAutofixParam {
    execution: Execution;
    targetFindingIds: string[];
    userComment: string;
    /** If provided (e.g. from intent step), reuse to avoid reloading. */
    context?: BugbotContext;
    branchOverride?: string;
}
/**
 * Runs the OpenCode build agent to fix the selected bugbot findings.
 * OpenCode applies changes directly in the workspace. Caller is responsible for
 * running verify commands and commit/push after this returns success.
 */
export declare class BugbotAutofixUseCase implements ParamUseCase<BugbotAutofixParam, Result[]> {
    taskId: string;
    private aiRepository;
    invoke(param: BugbotAutofixParam): Promise<Result[]>;
}
