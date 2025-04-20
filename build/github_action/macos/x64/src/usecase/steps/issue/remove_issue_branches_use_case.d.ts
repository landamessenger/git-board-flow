import { Execution } from "../../../data/model/execution";
import { Result } from "../../../data/model/result";
import { ParamUseCase } from "../../base/param_usecase";
/**
 * Remove any branch created for this issue
 */
export declare class RemoveIssueBranchesUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string;
    private branchRepository;
    invoke(param: Execution): Promise<Result[]>;
}
