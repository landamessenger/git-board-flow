import { Execution } from '../../data/model/execution';
import { Result } from '../../data/model/result';
import { ParamUseCase } from '../base/param_usecase';
export declare class PrepareAIContainerUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string;
    private dockerRepository;
    invoke(param: Execution): Promise<Result[]>;
}
