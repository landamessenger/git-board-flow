import { Execution } from "../../../data/model/execution";
import { Result } from "../../../data/model/result";
import { ParamUseCase } from "../../base/param_usecase";
export declare class CloseIssueAfterMergingUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string;
    private issueRepository;
    invoke(param: Execution): Promise<Result[]>;
    private removeBranches;
}
