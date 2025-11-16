/**
 * MCP Manager
 * Manages MCP connections and tool registration
 */

import { MCPClient } from './mcp_client';
import { MCPServerConfig } from './types';
import { MCPToolWrapper } from './mcp_tool';
import { ToolRegistry } from '../tools/tool_registry';
import { logInfo, logError } from '../../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

export interface MCPConfig {
  mcpServers: Record<string, MCPServerConfig>;
}

export class MCPManager {
  private client: MCPClient;
  private toolRegistry: ToolRegistry;
  private connectedServers: Set<string> = new Set();

  constructor(toolRegistry: ToolRegistry) {
    this.client = new MCPClient();
    this.toolRegistry = toolRegistry;
  }

  /**
   * Load MCP configuration from file
   */
  async loadConfig(configPath: string = '.mcp.json'): Promise<MCPConfig> {
    const fullPath = path.resolve(configPath);
    
    if (!fs.existsSync(fullPath)) {
      logInfo(`📝 MCP config not found at ${fullPath}, skipping MCP initialization`);
      return { mcpServers: {} };
    }

    try {
      const content = fs.readFileSync(fullPath, 'utf-8');
      const config: MCPConfig = JSON.parse(content);
      return config;
    } catch (error) {
      logError(`Failed to load MCP config: ${error}`);
      return { mcpServers: {} };
    }
  }

  /**
   * Initialize MCP connections from config
   */
  async initialize(configPath?: string): Promise<void> {
    const config = await this.loadConfig(configPath);

    for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
      try {
        await this.connectServer({ ...serverConfig, name });
      } catch (error) {
        logError(`Failed to connect to MCP server ${name}: ${error}`);
      }
    }
  }

  /**
   * Connect to an MCP server
   */
  async connectServer(config: MCPServerConfig): Promise<void> {
    if (this.connectedServers.has(config.name)) {
      logInfo(`MCP server ${config.name} already connected`);
      return;
    }

    try {
      await this.client.connect(config);
      this.connectedServers.add(config.name);

      // Register MCP tools
      const tools = this.client.getTools();
      for (const tool of tools) {
        // Get the tool name (remove server prefix if present)
        const toolName = tool.name.includes(':') 
          ? tool.name.split(':').slice(1).join(':')
          : tool.name;
        
        // Get the actual tool from client
        const mcpTool = this.client.getTool(config.name, toolName);
        if (mcpTool) {
          const wrapper = new MCPToolWrapper(this.client, config.name, mcpTool);
          this.toolRegistry.register(wrapper);
          logInfo(`🔧 Registered MCP tool: ${wrapper.getName()}`);
        }
      }
    } catch (error) {
      logError(`Failed to connect to MCP server ${config.name}: ${error}`);
      throw error;
    }
  }

  /**
   * Disconnect from an MCP server
   */
  async disconnectServer(serverName: string): Promise<void> {
    if (!this.connectedServers.has(serverName)) {
      return;
    }

    await this.client.disconnect(serverName);
    this.connectedServers.delete(serverName);

    // Remove tools from this server
    const toolNames = this.toolRegistry.getToolNames();
    for (const toolName of toolNames) {
      if (toolName.startsWith(`${serverName}:`)) {
        // Note: ToolRegistry doesn't have unregister, would need to add it
        // For now, tools remain registered but disconnected
      }
    }
  }

  /**
   * Get MCP client
   */
  getClient(): MCPClient {
    return this.client;
  }

  /**
   * Check if server is connected
   */
  isConnected(serverName: string): boolean {
    return this.connectedServers.has(serverName) && 
           this.client.isConnected(serverName);
  }

  /**
   * Get connected servers
   */
  getConnectedServers(): string[] {
    return Array.from(this.connectedServers);
  }

  /**
   * Disconnect from all servers
   */
  async disconnectAll(): Promise<void> {
    await this.client.disconnectAll();
    this.connectedServers.clear();
  }
}

