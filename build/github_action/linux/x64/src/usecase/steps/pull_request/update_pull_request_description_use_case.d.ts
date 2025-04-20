import { Execution } from "../../../data/model/execution";
import { Result } from "../../../data/model/result";
import { ParamUseCase } from "../../base/param_usecase";
export declare class UpdatePullRequestDescriptionUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string;
    private aiRepository;
    private pullRequestRepository;
    private fileRepository;
    private issueRepository;
    private projectRepository;
    invoke(param: Execution): Promise<Result[]>;
    private shouldIgnoreFile;
    private mergePatchSummaries;
    private groupFilesByDirectory;
    private formatFileChanges;
    private processFile;
    private processChanges;
}
