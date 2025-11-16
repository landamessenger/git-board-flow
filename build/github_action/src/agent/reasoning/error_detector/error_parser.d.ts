/**
 * Error Parser
 * Parses errors from agent results and tool calls
 */
import { AgentResult } from '../../types';
import { DetectedError } from './types';
export declare class ErrorParser {
    /**
     * Parse errors from agent result
     * Only uses structured format from report_errors tool - no text parsing
     */
    static parseErrors(result: AgentResult): DetectedError[];
    /**
     * Deduplicate errors based on file, line, and type
     */
    private static deduplicateErrors;
    /**
     * Clean and normalize error data from report_errors tool
     */
    private static cleanError;
}
