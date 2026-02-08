/**
 * MCP Client
 * Client for Model Context Protocol
 */
import { MCPServerConfig, MCPMessage, MCPTool, MCPResource, MCPPrompt } from './types';
export declare class MCPClient {
    private transports;
    private tools;
    private resources;
    private prompts;
    /**
     * Connect to an MCP server
     */
    connect(config: MCPServerConfig): Promise<void>;
    /**
     * Initialize MCP connection
     */
    private initialize;
    /**
     * Load tools from MCP server
     */
    private loadTools;
    /**
     * Load resources from MCP server
     */
    private loadResources;
    /**
     * Load prompts from MCP server
     */
    private loadPrompts;
    /**
     * Send request to MCP server
     */
    sendRequest(serverName: string, method: string, params?: any): Promise<MCPMessage>;
    /**
     * Call an MCP tool
     */
    callTool(serverName: string, toolName: string, input: Record<string, any>): Promise<any>;
    /**
     * Get all available tools
     */
    getTools(): MCPTool[];
    /**
     * Get tool by name
     */
    getTool(serverName: string, toolName: string): MCPTool | undefined;
    /**
     * Get all available resources
     */
    getResources(): MCPResource[];
    /**
     * Get all available prompts
     */
    getPrompts(): MCPPrompt[];
    /**
     * Check if server is connected
     */
    isConnected(serverName: string): boolean;
    /**
     * Disconnect from MCP server
     */
    disconnect(serverName: string): Promise<void>;
    /**
     * Disconnect from all servers
     */
    disconnectAll(): Promise<void>;
}
