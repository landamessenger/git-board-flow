import { Execution } from '../../data/model/execution';
import { Result } from '../../data/model/result';
import { ParamUseCase } from '../base/param_usecase';
export declare class CheckProgressUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string;
    private issueRepository;
    private branchRepository;
    private aiRepository;
    invoke(param: Execution): Promise<Result[]>;
    private buildProgressPrompt;
    /**
     * Check if a file should be ignored based on ignore patterns
     * This method matches the implementation in FileRepository.shouldIgnoreFile
     */
    private shouldIgnoreFile;
}
