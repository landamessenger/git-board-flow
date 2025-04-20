import { Execution } from "../../../data/model/execution";
import { Result } from "../../../data/model/result";
import { ParamUseCase } from "../../base/param_usecase";
export declare class LinkPullRequestIssueUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string;
    private pullRequestRepository;
    invoke(param: Execution): Promise<Result[]>;
}
