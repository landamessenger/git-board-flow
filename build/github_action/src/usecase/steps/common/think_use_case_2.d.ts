import { Execution } from '../../../data/model/execution';
import { Result } from '../../../data/model/result';
import { ParamUseCase } from '../../base/param_usecase';
export declare class ThinkUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string;
    private aiRepository;
    private fileRepository;
    private issueRepository;
    private fileImportAnalyzer;
    private fileCacheManager;
    private codebaseAnalyzer;
    private fileSearchService;
    private commentFormatter;
    private readonly MAX_ITERATIONS;
    private readonly MAX_FILES_TO_ANALYZE;
    private readonly MAX_CONSECUTIVE_SEARCHES;
    private readonly MAX_FILES_PER_READ;
    constructor();
    invoke(param: Execution): Promise<Result[]>;
    private getIssueDescription;
    private performReasoningStep;
    private generateFinalAnalysis;
    /**
     * Detect generic search terms that are too common and not useful
     */
    private detectGenericSearchTerms;
}
