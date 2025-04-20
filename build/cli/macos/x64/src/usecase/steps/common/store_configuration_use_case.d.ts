import { Execution } from "../../../data/model/execution";
import { ParamUseCase } from "../../base/param_usecase";
/**
 * Store las configuration in the description
 */
export declare class StoreConfigurationUseCase implements ParamUseCase<Execution, void> {
    taskId: string;
    private handler;
    invoke(param: Execution): Promise<void>;
}
