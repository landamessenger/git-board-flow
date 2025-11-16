/**
 * Response parser for OpenRouter JSON responses
 */

import { ParsedResponse, ToolCall } from '../types';

export class ResponseParser {
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
  static parse(jsonResponse: any): ParsedResponse {
    if (!jsonResponse || typeof jsonResponse !== 'object') {
      throw new Error('Invalid response format: expected object');
    }

    const response: ParsedResponse = {
      text: jsonResponse.response || jsonResponse.text || '',
      reasoning: jsonResponse.reasoning
    };

    // Parse tool calls if present
    if (jsonResponse.tool_calls && Array.isArray(jsonResponse.tool_calls)) {
      response.toolCalls = jsonResponse.tool_calls.map((tc: any, index: number) => {
        if (!tc.name) {
          throw new Error(`Tool call at index ${index} missing 'name' field`);
        }

        return {
          id: tc.id || this.generateToolCallId(index),
          name: tc.name,
          input: tc.input || tc.arguments || {}
        } as ToolCall;
      });
    } else if (jsonResponse.tool_calls !== undefined && !Array.isArray(jsonResponse.tool_calls)) {
      // If tool_calls exists but is not an array, treat as empty
      response.toolCalls = [];
    } else {
      // No tool_calls field, assume empty
      response.toolCalls = [];
    }

    return response;
  }

  /**
   * Generate a unique tool call ID
   */
  private static generateToolCallId(index: number): string {
    return `call_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Validate parsed response
   */
  static validate(parsed: ParsedResponse): boolean {
    if (!parsed.text && !parsed.toolCalls?.length) {
      return false;
    }

    if (parsed.toolCalls) {
      for (const toolCall of parsed.toolCalls) {
        if (!toolCall.id || !toolCall.name) {
          return false;
        }
      }
    }

    return true;
  }
}

