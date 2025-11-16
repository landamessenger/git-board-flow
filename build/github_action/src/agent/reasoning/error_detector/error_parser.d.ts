/**
 * Error Parser
 * Parses errors from agent results and tool calls
 */
import { AgentResult } from '../../types';
import { DetectedError } from './types';
export declare class ErrorParser {
    /**
     * Parse errors from agent result
     */
    static parseErrors(result: AgentResult): DetectedError[];
    /**
     * Extract errors from text response
     */
    private static extractErrorsFromText;
    /**
     * Extract errors from change description
     */
    private static extractErrorsFromChangeDescription;
    /**
     * Check if TODO content is error-related
     */
    private static isErrorRelatedTodo;
    /**
     * Extract error from TODO content
     */
    private static extractErrorFromTodo;
    /**
     * Check if content indicates a proposed change result
     */
    private static isProposedChangeResult;
}
