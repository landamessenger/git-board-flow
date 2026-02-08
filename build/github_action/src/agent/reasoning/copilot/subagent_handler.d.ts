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
     *
     * Uses a two-phase approach:
     * Phase 1: Subagents work in parallel (READ-ONLY) - analyze and propose changes
     * Phase 2: Coordinator agent executes changes sequentially
     */
    static processPromptWithSubAgents(agent: Agent, repositoryFiles: Map<string, string>, options: CopilotOptions, userPrompt: string, shouldApplyChanges?: boolean): Promise<CopilotResult>;
    /**
     * Create READ-ONLY tools for subagents (Phase 1)
     * Only allows reading files, searching, and proposing changes (in memory)
     * Does NOT allow applying changes or executing commands
     */
    private static createReadOnlySubagentTools;
    /**
     * Extract change plans from subagent results
     */
    private static extractChangePlans;
    /**
     * Execute changes sequentially using coordinator agent (Phase 2)
     */
    private static executeChangesSequentially;
    /**
     * Combine results from both phases
     */
    private static combinePhasesResults;
    /**
     * Extract changes from agent result
     */
    private static extractChangesFromResult;
    /**
     * Create tools for subagents (DEPRECATED - kept for backward compatibility)
     * @deprecated Use createReadOnlySubagentTools for Phase 1 instead
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
