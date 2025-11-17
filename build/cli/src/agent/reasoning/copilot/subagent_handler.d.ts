/**
 * Subagent Handler
 * Handles Copilot tasks using subagents for parallel processing
 */
import { Agent } from '../../core/agent';
import { CopilotOptions, CopilotResult } from './types';
export declare class SubagentHandler {
    private static readonly EXCLUDE_PATTERNS;
    /**
     * Process prompt using subagents for parallel processing
     */
    static processPromptWithSubAgents(agent: Agent, repositoryFiles: Map<string, string>, options: CopilotOptions, userPrompt: string): Promise<CopilotResult>;
    /**
     * Create tools for subagents
     */
    private static createSubagentTools;
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
    /**
     * Combine results from all subagents
     */
    private static combineSubagentResults;
}
