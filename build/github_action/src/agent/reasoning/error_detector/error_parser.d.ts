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
     * The tool already validates and cleans the data, so we just extract it directly
     */
    static parseErrors(result: AgentResult): DetectedError[];
}
