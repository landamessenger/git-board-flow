/**
 * Use case that performs whatever changes the user asked for (generic request).
 * Uses the OpenCode build agent to edit files and run commands in the workspace.
 * Caller is responsible for permission check and for running commit/push after success.
 */
import type { Execution } from "../../../data/model/execution";
import { ParamUseCase } from "../../base/param_usecase";
import { Result } from "../../../data/model/result";
export interface DoUserRequestParam {
    execution: Execution;
    userComment: string;
    branchOverride?: string;
}
export declare class DoUserRequestUseCase implements ParamUseCase<DoUserRequestParam, Result[]> {
    taskId: string;
    private aiRepository;
    invoke(param: DoUserRequestParam): Promise<Result[]>;
}
