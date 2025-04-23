import { Execution } from "../../../data/model/execution";
import { Result } from "../../../data/model/result";
import { ParamUseCase } from "../../base/param_usecase";
export declare class PrepareBranchesUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string;
    private branchRepository;
    invoke(param: Execution): Promise<Result[]>;
    private duplicateChunksByBranch;
}
