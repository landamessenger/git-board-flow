import type { Execution } from "../../../../data/model/execution";
import { ParamUseCase } from "../../../base/param_usecase";
import { Result } from "../../../../data/model/result";
export interface BugbotFixIntent {
    isFixRequest: boolean;
    targetFindingIds: string[];
}
/**
 * Calls OpenCode (plan agent) to decide if the user comment is requesting to fix
 * one or more bugbot findings and which finding ids to target. Returns the intent
 * in the result payload; when isFixRequest is true and targetFindingIds is non-empty,
 * the caller can run the autofix flow.
 */
export declare class DetectBugbotFixIntentUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string;
    private aiRepository;
    invoke(param: Execution): Promise<Result[]>;
}
