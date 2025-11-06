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
     * Extract imports from a file regardless of programming language
     */
    private extractImportsFromFile;
    /**
     * Resolve relative import path to absolute path
     */
    private resolveRelativePath;
    /**
     * Calculate SHA256 hash of file content
     */
    private calculateFileSHA;
    /**
     * Get path to .AI cache file (in repository root)
     */
    private getAICachePath;
    /**
     * Load cache from .AI file
     */
    private loadAICache;
    /**
     * Save cache to .AI file
     */
    private saveAICache;
    /**
     * Build relationship map from all files by extracting imports
     * Also builds reverse map (consumed_by)
     */
    private buildRelationshipMap;
    /**
     * Generate codebase analysis with file descriptions and relationships
     * This runs before the main reasoning loop to provide context
     * Uses relationship map built from imports + AI descriptions in batches
     */
    private generateCodebaseAnalysis;
    /**
     * Generate basic description from file path (fallback)
     */
    private generateBasicDescription;
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
