/**
 * Agent Initializer
 * Initializes agent with tools and repository files
 */
import { Agent } from '../../core/agent';
import { ErrorDetectionOptions } from './types';
import { ReadFileTool } from '../../tools/builtin_tools/read_file_tool';
import { SearchFilesTool } from '../../tools/builtin_tools/search_files_tool';
import { ProposeChangeTool } from '../../tools/builtin_tools/propose_change_tool';
import { ManageTodosTool } from '../../tools/builtin_tools/manage_todos_tool';
export interface AgentInitializerResult {
    agent: Agent;
    repositoryFiles: Map<string, string>;
}
export declare class AgentInitializer {
    private static readonly EXCLUDE_PATTERNS;
    private static readonly IGNORE_FILES;
    /**
     * Initialize agent with tools and repository files
     */
    static initialize(options: ErrorDetectionOptions): Promise<AgentInitializerResult>;
    /**
     * Load repository files from GitHub
     */
    private static loadRepositoryFiles;
    /**
     * Get default branch from repository
     */
    private static getDefaultBranch;
    /**
     * Create tools for the agent
     */
    static createTools(repositoryFiles: Map<string, string>): Promise<(ReadFileTool | SearchFilesTool | ProposeChangeTool | ManageTodosTool)[]>;
    /**
     * Create ManageTodosTool
     */
    private static createManageTodosTool;
    /**
     * Search files in repository
     */
    private static searchFiles;
    /**
     * Get all files (excluding compiled files)
     */
    private static getAllFiles;
}
