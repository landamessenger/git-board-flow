import { Execution } from "../../../data/model/execution";
import { Result } from "../../../data/model/result";
import { ParamUseCase } from "../../base/param_usecase";
/** Single finding from OpenCode (agent computes changes and returns these). */
export interface BugbotFinding {
    id: string;
    title: string;
    description: string;
    file?: string;
    line?: number;
    severity?: string;
    suggestion?: string;
}
export declare class DetectPotentialProblemsUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string;
    private issueRepository;
    private pullRequestRepository;
    private aiRepository;
    invoke(param: Execution): Promise<Result[]>;
}
