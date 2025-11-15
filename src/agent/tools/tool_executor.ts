/**
 * Tool Executor for Agent SDK
 * Executes tool calls and returns results
 */

import { BaseTool } from './base_tool';
import { ToolRegistry } from './tool_registry';
import { ToolCall, ToolResult, ToolExecutionResult } from '../types';
import { ToolExecutionError } from '../utils/error_handler';

export class ToolExecutor {
  constructor(private registry: ToolRegistry) {}

  /**
   * Execute a single tool call
   */
  async execute(toolCall: ToolCall): Promise<ToolResult> {
    const tool = this.registry.get(toolCall.name);

    if (!tool) {
      return {
        toolCallId: toolCall.id,
        content: `Error: Tool "${toolCall.name}" not found`,
        isError: true,
        errorMessage: `Tool "${toolCall.name}" is not registered`
      };
    }

    try {
      const executionResult = await tool.executeWithValidation(toolCall.input);

      if (!executionResult.success) {
        return {
          toolCallId: toolCall.id,
          content: executionResult.error || 'Tool execution failed',
          isError: true,
          errorMessage: executionResult.error
        };
      }

      // Convert result to string if needed
      const content = typeof executionResult.result === 'string'
        ? executionResult.result
        : JSON.stringify(executionResult.result, null, 2);

      return {
        toolCallId: toolCall.id,
        content
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return {
        toolCallId: toolCall.id,
        content: `Error executing tool: ${errorMessage}`,
        isError: true,
        errorMessage
      };
    }
  }

  /**
   * Execute multiple tool calls in parallel
   */
  async executeAll(toolCalls: ToolCall[]): Promise<ToolResult[]> {
    const promises = toolCalls.map(toolCall => this.execute(toolCall));
    return Promise.all(promises);
  }

  /**
   * Execute multiple tool calls sequentially
   */
  async executeAllSequential(toolCalls: ToolCall[]): Promise<ToolResult[]> {
    const results: ToolResult[] = [];
    
    for (const toolCall of toolCalls) {
      const result = await this.execute(toolCall);
      results.push(result);
    }
    
    return results;
  }

  /**
   * Check if tool is available
   */
  isToolAvailable(name: string): boolean {
    return this.registry.has(name);
  }

  /**
   * Get available tool names
   */
  getAvailableTools(): string[] {
    return this.registry.getToolNames();
  }

  /**
   * Get all tool definitions
   */
  getToolDefinitions() {
    return this.registry.getAllDefinitions();
  }
}

