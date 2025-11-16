/**
 * MCP Tool
 * Wrapper for MCP tools to integrate with BaseTool interface
 */

import { BaseTool } from '../tools/base_tool';
import { MCPClient } from './mcp_client';
import { MCPTool } from './types';

export class MCPToolWrapper extends BaseTool {
  constructor(
    private mcpClient: MCPClient,
    private serverName: string,
    private mcpTool: MCPTool
  ) {
    super();
  }

  getName(): string {
    return `${this.serverName}:${this.mcpTool.name}`;
  }

  getDescription(): string {
    return this.mcpTool.description;
  }

  getInputSchema(): {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
    additionalProperties?: boolean;
  } {
    return {
      type: 'object',
      properties: this.mcpTool.inputSchema.properties,
      required: this.mcpTool.inputSchema.required || [],
      additionalProperties: this.mcpTool.inputSchema.additionalProperties !== false
    };
  }

  async execute(input: Record<string, any>): Promise<any> {
    return await this.mcpClient.callTool(this.serverName, this.mcpTool.name, input);
  }
}

