import { Execution } from '../../data/model/execution';
import { Result } from '../../data/model/result';
import { ParamUseCase } from '../base/param_usecase';
export declare class RecommendStepsUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string;
    private issueRepository;
    private aiRepository;
    invoke(param: Execution): Promise<Result[]>;
}
