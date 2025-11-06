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
    /**
     * Generate codebase analysis with file descriptions and relationships
     * This runs before the main reasoning loop to provide context
     */
    private generateCodebaseAnalysis;
    /**
     * Generate fallback file descriptions when AI analysis fails
     */
    private generateFallbackFileDescriptions;
    /**
     * Format codebase analysis for inclusion in AI context
     */
    private formatCodebaseAnalysisForContext;
    private performReasoningStep;
    private generateFinalAnalysis;
    private formatReasoningComment;
    private getActionEmoji;
    private formatActionName;
    private formatProposedChange;
    /**
     * Detect programming language from file path/extension
     */
    private detectLanguageFromPath;
    private getChangeTypeEmoji;
}
