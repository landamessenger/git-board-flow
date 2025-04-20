import { Execution } from "../../../data/model/execution";
import { Result } from "../../../data/model/result";
import { ParamUseCase } from "../../base/param_usecase";
export declare class NotifyNewCommitOnIssueUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string;
    private issueRepository;
    private mergeBranchPattern;
    private ghAction;
    private separator;
    invoke(param: Execution): Promise<Result[]>;
}
