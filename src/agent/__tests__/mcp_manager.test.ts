/**
 * Tests for MCP Manager
 */

import { MCPManager } from '../mcp/mcp_manager';
import { ToolRegistry } from '../tools/tool_registry';
import { MCPServerConfig } from '../mcp/types';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('fs');
jest.mock('../mcp/mcp_client');

describe('MCPManager', () => {
  let manager: MCPManager;
  let toolRegistry: ToolRegistry;

  beforeEach(() => {
    toolRegistry = new ToolRegistry();
    manager = new MCPManager(toolRegistry);
    jest.clearAllMocks();
  });

  describe('loadConfig', () => {
    it('should load MCP config from file', async () => {
      const configContent = JSON.stringify({
        mcpServers: {
          test: {
            name: 'test',
            command: 'node',
            args: ['server.js']
          }
        }
      });

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(configContent);

      const config = await manager.loadConfig('.mcp.json');

      expect(config.mcpServers).toHaveProperty('test');
      expect(config.mcpServers.test.name).toBe('test');
    });

    it('should return empty config if file not found', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const config = await manager.loadConfig('.mcp.json');

      expect(config.mcpServers).toEqual({});
    });

    it('should handle invalid JSON gracefully', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue('invalid json');

      const config = await manager.loadConfig('.mcp.json');

      expect(config.mcpServers).toEqual({});
    });
  });

  describe('connectServer', () => {
    it('should connect to MCP server and register tools', async () => {
      // Mock MCPClient
      const mockClient = {
        connect: jest.fn().mockResolvedValue(undefined),
        getTools: jest.fn().mockReturnValue([
          {
            name: 'test_tool',
            description: 'Test tool',
            inputSchema: {
              type: 'object',
              properties: {},
              required: []
            }
          }
        ]),
        getTool: jest.fn().mockReturnValue({
          name: 'test_tool',
          description: 'Test tool',
          inputSchema: {
            type: 'object',
            properties: {},
            required: []
          }
        }),
        isConnected: jest.fn().mockReturnValue(true),
        disconnect: jest.fn().mockResolvedValue(undefined)
      };

      // Replace client with mock
      (manager as any).client = mockClient;

      const config: MCPServerConfig = {
        name: 'test-server',
        command: 'node',
        args: ['server.js']
      };

      await manager.connectServer(config);

      expect(mockClient.connect).toHaveBeenCalledWith(config);
      expect(toolRegistry.getToolNames()).toContain('test-server:test_tool');
    });

    it('should not connect if already connected', async () => {
      const mockClient = {
        connect: jest.fn().mockResolvedValue(undefined),
        getTools: jest.fn().mockReturnValue([]),
        getTool: jest.fn(),
        isConnected: jest.fn().mockReturnValue(true),
        disconnect: jest.fn().mockResolvedValue(undefined)
      };

      (manager as any).client = mockClient;
      (manager as any).connectedServers.add('test-server');

      const config: MCPServerConfig = {
        name: 'test-server',
        command: 'node'
      };

      await manager.connectServer(config);

      expect(mockClient.connect).not.toHaveBeenCalled();
    });
  });

  describe('isConnected', () => {
    it('should return true if server is connected', () => {
      const mockClient = {
        isConnected: jest.fn().mockReturnValue(true)
      };

      (manager as any).client = mockClient;
      (manager as any).connectedServers.add('test-server');

      expect(manager.isConnected('test-server')).toBe(true);
    });

    it('should return false if server is not connected', () => {
      expect(manager.isConnected('non-existent')).toBe(false);
    });
  });

  describe('getConnectedServers', () => {
    it('should return list of connected servers', () => {
      (manager as any).connectedServers.add('server1');
      (manager as any).connectedServers.add('server2');

      const servers = manager.getConnectedServers();

      expect(servers).toContain('server1');
      expect(servers).toContain('server2');
    });
  });
});

