import { Execution } from '../../../data/model/execution';
import { Result } from '../../../data/model/result';
import { ParamUseCase } from '../../base/param_usecase';
export declare class ThinkUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string;
    private aiRepository;
    private fileRepository;
    private issueRepository;
    private readonly MAX_ITERATIONS;
    private readonly MAX_FILES_TO_ANALYZE;
    private readonly MAX_CONSECUTIVE_SEARCHES;
    invoke(param: Execution): Promise<Result[]>;
    private getIssueDescription;
    private buildFileIndex;
    private searchFiles;
    private performReasoningStep;
    private generateFinalAnalysis;
    private formatReasoningComment;
    private getActionEmoji;
    private formatActionName;
    private formatProposedChange;
    private getChangeTypeEmoji;
}
