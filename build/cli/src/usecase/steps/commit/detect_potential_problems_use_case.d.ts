import { Execution } from "../../../data/model/execution";
import { Result } from "../../../data/model/result";
import { ParamUseCase } from "../../base/param_usecase";
export type { BugbotFinding } from "./bugbot/types";
export declare class DetectPotentialProblemsUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string;
    private aiRepository;
    invoke(param: Execution): Promise<Result[]>;
}
