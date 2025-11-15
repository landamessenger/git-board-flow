/**
 * Tool Executor for Agent SDK
 * Executes tool calls and returns results
 */
import { ToolRegistry } from './tool_registry';
import { ToolCall, ToolResult } from '../types';
export declare class ToolExecutor {
    private registry;
    constructor(registry: ToolRegistry);
    /**
     * Execute a single tool call
     */
    execute(toolCall: ToolCall): Promise<ToolResult>;
    /**
     * Execute multiple tool calls in parallel
     */
    executeAll(toolCalls: ToolCall[]): Promise<ToolResult[]>;
    /**
     * Execute multiple tool calls sequentially
     */
    executeAllSequential(toolCalls: ToolCall[]): Promise<ToolResult[]>;
    /**
     * Check if tool is available
     */
    isToolAvailable(name: string): boolean;
    /**
     * Get available tool names
     */
    getAvailableTools(): string[];
    /**
     * Get all tool definitions
     */
    getToolDefinitions(): import("../types").ToolDefinition[];
}
