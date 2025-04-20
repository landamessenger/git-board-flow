import { Execution } from "../../../data/model/execution";
import { Result } from "../../../data/model/result";
import { ParamUseCase } from "../../base/param_usecase";
export declare class CheckIssueCommentLanguageUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string;
    private aiRepository;
    private issueRepository;
    private translatedKey;
    invoke(param: Execution): Promise<Result[]>;
}
