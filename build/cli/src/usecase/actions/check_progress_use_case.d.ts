import { Execution } from '../../data/model/execution';
import { Result } from '../../data/model/result';
import { ParamUseCase } from '../base/param_usecase';
export declare class CheckProgressUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string;
    private issueRepository;
    private branchRepository;
    private pullRequestRepository;
    private aiRepository;
    invoke(param: Execution): Promise<Result[]>;
    /**
     * Calls the OpenCode agent once and returns parsed progress, summary, and reasoning.
     * HTTP-level retries are handled by AiRepository (OPENCODE_MAX_RETRIES).
     */
    private fetchProgressAttempt;
    /**
     * Returns true if the reasoning text looks truncated (e.g. ends with ":" or trailing spaces,
     * or no sentence-ending punctuation), so we can append a note in the comment.
     */
    private isReasoningLikelyTruncated;
}
