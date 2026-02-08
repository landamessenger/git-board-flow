/**
 * MCP Tool
 * Wrapper for MCP tools to integrate with BaseTool interface
 */
import { BaseTool } from '../tools/base_tool';
import { MCPClient } from './mcp_client';
import { MCPTool } from './types';
export declare class MCPToolWrapper extends BaseTool {
    private mcpClient;
    private serverName;
    private mcpTool;
    constructor(mcpClient: MCPClient, serverName: string, mcpTool: MCPTool);
    getName(): string;
    getDescription(): string;
    getInputSchema(): {
        type: 'object';
        properties: Record<string, any>;
        required: string[];
        additionalProperties?: boolean;
    };
    execute(input: Record<string, any>): Promise<any>;
}
