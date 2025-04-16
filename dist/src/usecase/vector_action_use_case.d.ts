import { Execution } from '../data/model/execution';
import { Result } from '../data/model/result';
import { ParamUseCase } from './base/param_usecase';
export declare class VectorActionUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string;
    private dockerRepository;
    private fileRepository;
    private readonly CODE_INSTRUCTION_BLOCK;
    private readonly CODE_INSTRUCTION_LINE;
    invoke(param: Execution): Promise<Result[]>;
}
