/**
 * MCP Client
 * Client for Model Context Protocol
 */

import { MCPServerConfig, MCPMessage, MCPTool, MCPResource, MCPPrompt, MCPInitializeResult } from './types';
import { MCPTransport, StdioTransport, HTTPTransport, SSETransport } from './mcp_transport';
import { logInfo, logError, logDebugInfo } from '../../utils/logger';

export class MCPClient {
  private transports: Map<string, MCPTransport> = new Map();
  private tools: Map<string, MCPTool> = new Map();
  private resources: Map<string, MCPResource> = new Map();
  private prompts: Map<string, MCPPrompt> = new Map();

  /**
   * Connect to an MCP server
   */
  async connect(config: MCPServerConfig): Promise<void> {
    logInfo(`🔌 Connecting to MCP server: ${config.name}`);

    let transport: MCPTransport;

    const transportType = config.transport || (config.url ? 'http' : 'stdio');

    switch (transportType) {
      case 'stdio':
        if (!config.command) {
          throw new Error('Command required for stdio transport');
        }
        transport = new StdioTransport(
          config.command,
          config.args || [],
          config.env || {}
        );
        if ('connect' in transport && typeof transport.connect === 'function') {
          await transport.connect();
        }
        break;

      case 'http':
        if (!config.url) {
          throw new Error('URL required for HTTP transport');
        }
        transport = new HTTPTransport(config.url, config.headers);
        if ('connect' in transport && typeof transport.connect === 'function') {
          await transport.connect();
        }
        break;

      case 'sse':
        if (!config.url) {
          throw new Error('URL required for SSE transport');
        }
        transport = new SSETransport(config.url, config.headers);
        if ('connect' in transport && typeof transport.connect === 'function') {
          await transport.connect();
        }
        break;

      default:
        throw new Error(`Unsupported transport: ${transportType}`);
    }

    this.transports.set(config.name, transport);

    // Initialize MCP connection
    await this.initialize(config.name);

    logInfo(`✅ Connected to MCP server: ${config.name}`);
  }

  /**
   * Initialize MCP connection
   */
  private async initialize(serverName: string): Promise<void> {
    const transport = this.transports.get(serverName);
    if (!transport) {
      throw new Error(`Transport not found for server: ${serverName}`);
    }

    // Send initialize request
    const initMessage = await this.sendRequest(serverName, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'git-board-flow-agent',
        version: '1.0.0'
      }
    });

    if (initMessage.error) {
      throw new Error(`MCP initialization failed: ${initMessage.error.message}`);
    }

    const result = initMessage.result as MCPInitializeResult;
    logDebugInfo(`MCP initialized: ${result.serverInfo.name} v${result.serverInfo.version}`);

    // Load tools, resources, and prompts
    await this.loadTools(serverName);
    await this.loadResources(serverName);
    await this.loadPrompts(serverName);
  }

  /**
   * Load tools from MCP server
   */
  private async loadTools(serverName: string): Promise<void> {
    try {
      const response = await this.sendRequest(serverName, 'tools/list', {});
      
      if (response.error) {
        logDebugInfo(`MCP server ${serverName} does not support tools`);
        return;
      }

      const tools = (response.result as any)?.tools || [];
      
      for (const tool of tools) {
        const toolKey = `${serverName}:${tool.name}`;
        this.tools.set(toolKey, tool);
        logDebugInfo(`📦 MCP tool registered: ${toolKey}`);
      }
    } catch (error) {
      logDebugInfo(`Failed to load tools from ${serverName}: ${error}`);
    }
  }

  /**
   * Load resources from MCP server
   */
  private async loadResources(serverName: string): Promise<void> {
    try {
      const response = await this.sendRequest(serverName, 'resources/list', {});
      
      if (response.error) {
        logDebugInfo(`MCP server ${serverName} does not support resources`);
        return;
      }

      const resources = (response.result as any)?.resources || [];
      
      for (const resource of resources) {
        const resourceKey = `${serverName}:${resource.uri}`;
        this.resources.set(resourceKey, resource);
      }
    } catch (error) {
      logDebugInfo(`Failed to load resources from ${serverName}: ${error}`);
    }
  }

  /**
   * Load prompts from MCP server
   */
  private async loadPrompts(serverName: string): Promise<void> {
    try {
      const response = await this.sendRequest(serverName, 'prompts/list', {});
      
      if (response.error) {
        logDebugInfo(`MCP server ${serverName} does not support prompts`);
        return;
      }

      const prompts = (response.result as any)?.prompts || [];
      
      for (const prompt of prompts) {
        const promptKey = `${serverName}:${prompt.name}`;
        this.prompts.set(promptKey, prompt);
      }
    } catch (error) {
      logDebugInfo(`Failed to load prompts from ${serverName}: ${error}`);
    }
  }

  /**
   * Send request to MCP server
   */
  async sendRequest(serverName: string, method: string, params?: any): Promise<MCPMessage> {
    const transport = this.transports.get(serverName);
    if (!transport) {
      throw new Error(`MCP server not connected: ${serverName}`);
    }

    if (transport instanceof StdioTransport) {
      return await transport.sendRequest(method, params);
    } else if (transport instanceof HTTPTransport) {
      return await transport.sendRequest(method, params);
    } else {
      throw new Error(`Unsupported transport type for ${serverName}`);
    }
  }

  /**
   * Call an MCP tool
   */
  async callTool(serverName: string, toolName: string, input: Record<string, any>): Promise<any> {
    logDebugInfo(`🔧 Calling MCP tool: ${serverName}:${toolName}`);

    const response = await this.sendRequest(serverName, 'tools/call', {
      name: toolName,
      arguments: input
    });

    if (response.error) {
      throw new Error(`MCP tool error: ${response.error.message}`);
    }

    const result = (response.result as any)?.content || response.result;
    return result;
  }

  /**
   * Get all available tools
   */
  getTools(): MCPTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tool by name
   */
  getTool(serverName: string, toolName: string): MCPTool | undefined {
    // Try with server prefix first
    const withPrefix = this.tools.get(`${serverName}:${toolName}`);
    if (withPrefix) return withPrefix;
    
    // Try without prefix (tool might be stored with just name)
    for (const [key, tool] of this.tools) {
      if (key.endsWith(`:${toolName}`) || key === toolName) {
        return tool;
      }
    }
    
    return undefined;
  }

  /**
   * Get all available resources
   */
  getResources(): MCPResource[] {
    return Array.from(this.resources.values());
  }

  /**
   * Get all available prompts
   */
  getPrompts(): MCPPrompt[] {
    return Array.from(this.prompts.values());
  }

  /**
   * Check if server is connected
   */
  isConnected(serverName: string): boolean {
    const transport = this.transports.get(serverName);
    return transport ? transport.isConnected() : false;
  }

  /**
   * Disconnect from MCP server
   */
  async disconnect(serverName: string): Promise<void> {
    const transport = this.transports.get(serverName);
    if (transport) {
      await transport.close();
      this.transports.delete(serverName);
      
      // Remove tools from this server
      for (const [key] of this.tools) {
        if (key.startsWith(`${serverName}:`)) {
          this.tools.delete(key);
        }
      }
      
      logInfo(`🔌 Disconnected from MCP server: ${serverName}`);
    }
  }

  /**
   * Disconnect from all servers
   */
  async disconnectAll(): Promise<void> {
    const serverNames = Array.from(this.transports.keys());
    for (const name of serverNames) {
      await this.disconnect(name);
    }
  }
}

