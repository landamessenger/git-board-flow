/**
 * Response parser for OpenRouter JSON responses
 */
import { ParsedResponse } from '../types';
export declare class ResponseParser {
    /**
     * Parse JSON response from OpenRouter
     * Expected format:
     * {
     *   "reasoning": "...",
     *   "response": "...",
     *   "tool_calls": [
     *     {
     *       "id": "call_1",
     *       "name": "read_file",
     *       "input": { "file_path": "..." }
     *     }
     *   ]
     * }
     */
    static parse(jsonResponse: any): ParsedResponse;
    /**
     * Generate a unique tool call ID
     */
    private static generateToolCallId;
    /**
     * Validate parsed response
     */
    static validate(parsed: ParsedResponse): boolean;
}
