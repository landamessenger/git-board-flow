/**
 * MCP Manager
 * Manages MCP connections and tool registration
 */
import { MCPClient } from './mcp_client';
import { MCPServerConfig } from './types';
import { ToolRegistry } from '../tools/tool_registry';
export interface MCPConfig {
    mcpServers: Record<string, MCPServerConfig>;
}
export declare class MCPManager {
    private client;
    private toolRegistry;
    private connectedServers;
    constructor(toolRegistry: ToolRegistry);
    /**
     * Load MCP configuration from file
     */
    loadConfig(configPath?: string): Promise<MCPConfig>;
    /**
     * Initialize MCP connections from config
     */
    initialize(configPath?: string): Promise<void>;
    /**
     * Connect to an MCP server
     */
    connectServer(config: MCPServerConfig): Promise<void>;
    /**
     * Disconnect from an MCP server
     */
    disconnectServer(serverName: string): Promise<void>;
    /**
     * Get MCP client
     */
    getClient(): MCPClient;
    /**
     * Check if server is connected
     */
    isConnected(serverName: string): boolean;
    /**
     * Get connected servers
     */
    getConnectedServers(): string[];
    /**
     * Disconnect from all servers
     */
    disconnectAll(): Promise<void>;
}
