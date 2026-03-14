import { Execution } from "../../data/model/execution";
import { Result } from "../../data/model/result";
import { ParamUseCase } from "../base/param_usecase";
export declare class InitialSetupUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string;
    invoke(param: Execution): Promise<Result[]>;
    private verifyGitHubAccess;
    private ensureLabels;
    private ensureProgressLabels;
    private ensureIssueTypes;
    /**
     * If the repository has no version tags, create default tag v1.0.0 on the default branch.
     * Used by "copilot setup" so release/hotfix issues get a base version.
     */
    private ensureDefaultVersion;
}
