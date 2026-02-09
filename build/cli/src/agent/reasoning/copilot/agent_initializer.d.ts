/**
 * Agent Initializer
 * Initializes agent with tools and repository files for Copilot
 */
import { Agent } from '../../core/agent';
import { CopilotOptions } from './types';
import { ReadFileTool } from '../../tools/builtin_tools/read_file_tool';
import { SearchFilesTool } from '../../tools/builtin_tools/search_files_tool';
import { ProposeChangeTool } from '../../tools/builtin_tools/propose_change_tool';
import { ApplyChangesTool } from '../../tools/builtin_tools/apply_changes_tool';
import { ExecuteCommandTool } from '../../tools/builtin_tools/execute_command_tool';
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
    static initialize(options: CopilotOptions): Promise<AgentInitializerResult>;
    /**
     * Load repository files from GitHub
     */
    private static loadRepositoryFiles;
    /**
     * Create tools for the agent
     */
    static createTools(repositoryFiles: Map<string, string>, options: CopilotOptions): Promise<(ReadFileTool | SearchFilesTool | ProposeChangeTool | ManageTodosTool | ApplyChangesTool | ExecuteCommandTool)[]>;
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
