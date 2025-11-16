/**
 * Subagent Handler
 * Handles error detection using subagents for parallel processing
 */
import { Agent } from '../../core/agent';
import { ErrorDetectionOptions, ErrorDetectionResult } from './types';
export declare class SubagentHandler {
    private static readonly EXCLUDE_PATTERNS;
    /**
     * Detect errors using subagents for parallel processing
     */
    static detectErrorsWithSubAgents(agent: Agent, repositoryFiles: Map<string, string>, options: ErrorDetectionOptions, userPrompt: string): Promise<ErrorDetectionResult>;
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
     */
    private static combineSubagentResults;
}
