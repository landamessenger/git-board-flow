/**
 * When a question or help issue is newly opened, posts an initial helpful reply
 * based on the issue description (OpenCode Plan agent). The user can still
 * @mention the bot later for follow-up answers (ThinkUseCase).
 */
import { Execution } from '../../../data/model/execution';
import { Result } from '../../../data/model/result';
import { ParamUseCase } from '../../base/param_usecase';
export declare class AnswerIssueHelpUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string;
    private aiRepository;
    private issueRepository;
    invoke(param: Execution): Promise<Result[]>;
}
