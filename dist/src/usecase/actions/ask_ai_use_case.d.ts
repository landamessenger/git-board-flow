import { Execution } from '../../data/model/execution';
import { Result } from '../../data/model/result';
import { ParamUseCase } from '../base/param_usecase';
export declare class AskActionUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string;
    private dockerRepository;
    private fileRepository;
    private aiRepository;
    private issueRepository;
    private readonly CODE_INSTRUCTION_ASK;
    invoke(param: Execution): Promise<Result[]>;
    private getRelatedFiles;
}
