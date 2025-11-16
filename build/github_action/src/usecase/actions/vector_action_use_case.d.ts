import { Execution } from '../../data/model/execution';
import { Result } from '../../data/model/result';
import { ParamUseCase } from '../base/param_usecase';
export declare class VectorActionUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string;
    private fileRepository;
    private branchRepository;
    private aiRepository;
    private fileImportAnalyzer;
    private fileCacheManager;
    private codebaseAnalyzer;
    constructor();
    invoke(param: Execution): Promise<Result[]>;
    private prepareCacheOnBranch;
    private removeOrphanedBranches;
    /**
     * Detect errors for a specific file using ErrorDetector
     * Analyzes only the target file, ignoring related files
     */
    private detectErrorsForFile;
}
