import { Execution } from '../../../data/model/execution';
import { Result } from '../../../data/model/result';
import { ParamUseCase } from '../../base/param_usecase';
export declare class ThinkUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string;
    private aiRepository;
    private fileRepository;
    private issueRepository;
    private supabaseRepository;
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
     * Initialize Supabase repository if config is available
     */
    private initSupabaseRepository;
    /**
     * Load cache from Supabase (or return empty map if Supabase not available)
     */
    private loadAICache;
    /**
     * Save cache entry to Supabase
     */
    private saveAICacheEntry;
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
