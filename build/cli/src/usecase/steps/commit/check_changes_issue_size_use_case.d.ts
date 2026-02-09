import { Execution } from "../../../data/model/execution";
import { Result } from "../../../data/model/result";
import { ParamUseCase } from "../../base/param_usecase";
export declare class CheckChangesIssueSizeUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string;
    private branchRepository;
    private issueRepository;
    private projectRepository;
    private pullRequestRepository;
    invoke(param: Execution): Promise<Result[]>;
}
