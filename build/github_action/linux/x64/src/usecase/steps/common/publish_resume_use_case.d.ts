import { Execution } from "../../../data/model/execution";
import { ParamUseCase } from "../../base/param_usecase";
/**
 * Publish the resume of actions
 */
export declare class PublishResultUseCase implements ParamUseCase<Execution, void> {
    taskId: string;
    private issueRepository;
    invoke(param: Execution): Promise<void>;
}
