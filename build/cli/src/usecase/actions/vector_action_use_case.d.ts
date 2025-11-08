import { Execution } from '../../data/model/execution';
import { Result } from '../../data/model/result';
import { ParamUseCase } from '../base/param_usecase';
export declare class VectorActionUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string;
    private fileRepository;
    private aiRepository;
    private fileImportAnalyzer;
    private fileCacheManager;
    private codebaseAnalyzer;
    private readonly CODE_INSTRUCTION_BLOCK;
    private readonly CODE_INSTRUCTION_LINE;
    constructor();
    invoke(param: Execution): Promise<Result[]>;
    private checkChunksInSupabase;
    private uploadChunksToSupabase;
    private duplicateChunksToBranch;
}
