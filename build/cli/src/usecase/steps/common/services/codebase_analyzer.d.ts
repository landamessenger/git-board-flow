import { Execution } from '../../../../data/model/execution';
import { AiRepository } from '../../../../data/repository/ai_repository';
import { FileImportAnalyzer } from './file_import_analyzer';
import { FileCacheManager } from './file_cache_manager';
export interface FileAnalysisResult {
    path: string;
    description: string;
    consumes: string[];
    consumed_by: string[];
}
/**
 * Service for analyzing codebase structure and generating file descriptions
 */
export declare class CodebaseAnalyzer {
    private aiRepository;
    private fileImportAnalyzer;
    private fileCacheManager;
    constructor(aiRepository: AiRepository, fileImportAnalyzer: FileImportAnalyzer, fileCacheManager: FileCacheManager);
    /**
     * Generate codebase analysis with file descriptions and relationships
     * This runs before the main reasoning loop to provide context
     * Uses relationship map built from imports + AI descriptions in batches
     */
    generateCodebaseAnalysis(param: Execution, repositoryFiles: Map<string, string>, question: string): Promise<FileAnalysisResult[]>;
    /**
     * Generate basic description from file path (fallback)
     */
    generateBasicDescription(path: string): string;
    /**
     * Generate fallback file descriptions when AI analysis fails
     */
    generateFallbackFileDescriptions(files: Array<[string, string]>): FileAnalysisResult[];
    /**
     * Format codebase analysis for inclusion in AI context
     */
    formatCodebaseAnalysisForContext(analysis: FileAnalysisResult[]): string;
}
