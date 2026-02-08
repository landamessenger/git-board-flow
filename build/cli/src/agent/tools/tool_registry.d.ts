/**
 * Tool Registry for managing available tools
 */
import { BaseTool } from './base_tool';
import { ToolDefinition } from '../types';
export declare class ToolRegistry {
    private tools;
    /**
     * Register a tool
     */
    register(tool: BaseTool): void;
    /**
     * Register multiple tools
     */
    registerAll(tools: BaseTool[]): void;
    /**
     * Get tool by name
     */
    get(name: string): BaseTool | undefined;
    /**
     * Check if tool exists
     */
    has(name: string): boolean;
    /**
     * Get all tool definitions
     */
    getAllDefinitions(): ToolDefinition[];
    /**
     * Get all registered tool names
     */
    getToolNames(): string[];
    /**
     * Clear all tools
     */
    clear(): void;
    /**
     * Get tool count
     */
    getCount(): number;
}
