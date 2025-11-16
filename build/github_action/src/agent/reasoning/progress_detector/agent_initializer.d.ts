/**
 * Agent Initializer
 * Initializes agent with tools and repository files for progress detection
 */
import { Agent } from '../../core/agent';
import { ProgressDetectionOptions } from './types';
import { ReadFileTool } from '../../tools/builtin_tools/read_file_tool';
import { SearchFilesTool } from '../../tools/builtin_tools/search_files_tool';
import { ReportProgressTool } from '../../tools/builtin_tools/report_progress_tool';
export interface AgentInitializerResult {
    agent: Agent;
    repositoryFiles: Map<string, string>;
    reportedProgress?: {
        progress: number;
        summary: string;
    };
}
export declare class AgentInitializer {
    private static readonly EXCLUDE_PATTERNS;
    private static readonly IGNORE_FILES;
    /**
     * Initialize agent with tools and repository files
     */
    static initialize(options: ProgressDetectionOptions): Promise<AgentInitializerResult>;
    /**
     * Load repository files from GitHub
     * Only loads changed files if available, otherwise loads all files from the branch
     */
    private static loadRepositoryFiles;
    /**
     * Create tools for the agent
     */
    static createTools(repositoryFiles: Map<string, string>, onProgressReported?: (progress: number, summary: string) => void): Promise<(ReadFileTool | SearchFilesTool | ReportProgressTool)[]>;
    /**
     * Search files in repository
     */
    private static searchFiles;
    /**
     * Get all files (excluding compiled files)
     */
    private static getAllFiles;
}
