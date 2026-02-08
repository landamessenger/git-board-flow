/**
 * Subagent Handler
 * Handles progress detection using subagents for parallel processing
 */
import { Agent } from '../../core/agent';
import { ProgressDetectionOptions, ProgressDetectionResult } from './types';
export declare class SubagentHandler {
    private static readonly EXCLUDE_PATTERNS;
    /**
     * Detect progress using subagents for parallel processing
     */
    static detectProgressWithSubAgents(agent: Agent, repositoryFiles: Map<string, string>, options: ProgressDetectionOptions, userPrompt: string): Promise<ProgressDetectionResult>;
    /**
     * Create tools for subagents
     */
    private static createSubagentTools;
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
     * Calculates average progress and combines summaries
     */
    private static combineSubagentResults;
}
