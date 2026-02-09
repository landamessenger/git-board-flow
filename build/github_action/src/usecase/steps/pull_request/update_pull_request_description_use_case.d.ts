import { Execution } from "../../../data/model/execution";
import { Result } from "../../../data/model/result";
import { ParamUseCase } from "../../base/param_usecase";
export declare class UpdatePullRequestDescriptionUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string;
    private aiRepository;
    private pullRequestRepository;
    private issueRepository;
    private projectRepository;
    invoke(param: Execution): Promise<Result[]>;
    /**
     * Builds the PR description prompt. We do not send the diff from our side:
     * we pass the base and head branch so the OpenCode agent can run `git diff`
     * in the workspace and write a professional summary (not a file-by-file list).
     */
    private buildPrDescriptionPrompt;
}
