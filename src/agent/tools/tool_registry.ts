/**
 * Tool Registry for managing available tools
 */

import { BaseTool } from './base_tool';
import { ToolDefinition, ToolCall, ToolResult } from '../types';

export class ToolRegistry {
  private tools: Map<string, BaseTool> = new Map();

  /**
   * Register a tool
   */
  register(tool: BaseTool): void {
    const name = tool.getName();
    if (this.tools.has(name)) {
      throw new Error(`Tool with name "${name}" is already registered`);
    }
    this.tools.set(name, tool);
  }

  /**
   * Register multiple tools
   */
  registerAll(tools: BaseTool[]): void {
    for (const tool of tools) {
      this.register(tool);
    }
  }

  /**
   * Get tool by name
   */
  get(name: string): BaseTool | undefined {
    return this.tools.get(name);
  }

  /**
   * Check if tool exists
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Get all tool definitions
   */
  getAllDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map(tool => tool.getDefinition());
  }

  /**
   * Get all registered tool names
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Clear all tools
   */
  clear(): void {
    this.tools.clear();
  }

  /**
   * Get tool count
   */
  getCount(): number {
    return this.tools.size;
  }
}

