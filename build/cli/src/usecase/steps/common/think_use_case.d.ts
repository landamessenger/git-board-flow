import { Execution } from '../../../data/model/execution';
import { Result } from '../../../data/model/result';
import { ParamUseCase } from '../../base/param_usecase';
export declare class ThinkUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string;
    private fileRepository;
    private issueRepository;
    invoke(param: Execution): Promise<Result[]>;
    private getIssueDescription;
}
