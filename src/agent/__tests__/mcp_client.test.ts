/**
 * Tests for MCP Client
 */

import { MCPClient } from '../mcp/mcp_client';
import { MCPServerConfig } from '../mcp/types';
import { StdioTransport, HTTPTransport } from '../mcp/mcp_transport';

// Mock transports
jest.mock('../mcp/mcp_transport');

describe('MCPClient', () => {
  let client: MCPClient;

  beforeEach(() => {
    client = new MCPClient();
    jest.clearAllMocks();
  });

  describe('connect', () => {
    it('should connect to stdio MCP server', async () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        command: 'node',
        args: ['server.js'],
        transport: 'stdio'
      };

      // Mock transport
      const mockTransport = {
        connect: jest.fn().mockResolvedValue(undefined),
        sendRequest: jest.fn()
          .mockResolvedValueOnce({
            jsonrpc: '2.0',
            id: 1,
            result: {
              protocolVersion: '2024-11-05',
              capabilities: {},
              serverInfo: { name: 'test', version: '1.0.0' }
            }
          })
          .mockResolvedValueOnce({
            jsonrpc: '2.0',
            id: 2,
            result: { tools: [] }
          })
          .mockResolvedValueOnce({
            jsonrpc: '2.0',
            id: 3,
            result: { resources: [] }
          })
          .mockResolvedValueOnce({
            jsonrpc: '2.0',
            id: 4,
            result: { prompts: [] }
          }),
        isConnected: jest.fn().mockReturnValue(true),
        close: jest.fn().mockResolvedValue(undefined),
        send: jest.fn().mockResolvedValue(undefined),
        receive: jest.fn()
      };

      (StdioTransport as any).mockImplementation(() => mockTransport);

      await expect(client.connect(config)).resolves.not.toThrow();
    });

    it('should connect to HTTP MCP server', async () => {
      const config: MCPServerConfig = {
        name: 'http-server',
        url: 'https://mcp.example.com',
        transport: 'http'
      };

      const mockTransport = {
        connect: jest.fn().mockResolvedValue(undefined),
        sendRequest: jest.fn()
          .mockResolvedValueOnce({
            jsonrpc: '2.0',
            id: 1,
            result: {
              protocolVersion: '2024-11-05',
              capabilities: {},
              serverInfo: { name: 'test', version: '1.0.0' }
            }
          })
          .mockResolvedValueOnce({
            jsonrpc: '2.0',
            id: 2,
            result: { tools: [] }
          })
          .mockResolvedValueOnce({
            jsonrpc: '2.0',
            id: 3,
            result: { resources: [] }
          })
          .mockResolvedValueOnce({
            jsonrpc: '2.0',
            id: 4,
            result: { prompts: [] }
          }),
        isConnected: jest.fn().mockReturnValue(true),
        close: jest.fn().mockResolvedValue(undefined),
        send: jest.fn().mockResolvedValue(undefined),
        receive: jest.fn()
      };

      (HTTPTransport as any).mockImplementation(() => mockTransport);

      await expect(client.connect(config)).resolves.not.toThrow();
    });

    it('should throw error if command missing for stdio', async () => {
      const config: MCPServerConfig = {
        name: 'test',
        transport: 'stdio'
      };

      await expect(client.connect(config)).rejects.toThrow('Command required');
    });

    it('should throw error if URL missing for HTTP', async () => {
      const config: MCPServerConfig = {
        name: 'test',
        transport: 'http'
      };

      await expect(client.connect(config)).rejects.toThrow('URL required');
    });
  });

  describe('callTool', () => {
    it('should call MCP tool successfully', async () => {
      // Setup mock
      const mockTransport = {
        connect: jest.fn().mockResolvedValue(undefined),
        sendRequest: jest.fn()
          .mockResolvedValueOnce({
            jsonrpc: '2.0',
            id: 1,
            result: {
              protocolVersion: '2024-11-05',
              capabilities: {},
              serverInfo: { name: 'test', version: '1.0.0' }
            }
          })
          .mockResolvedValueOnce({
            jsonrpc: '2.0',
            id: 2,
            result: {
              tools: [
                {
                  name: 'test_tool',
                  description: 'Test tool',
                  inputSchema: {
                    type: 'object',
                    properties: { query: { type: 'string' } },
                    required: ['query']
                  }
                }
              ]
            }
          })
          .mockResolvedValueOnce({
            jsonrpc: '2.0',
            id: 3,
            result: { content: [{ type: 'text', text: 'Result' }] }
          }),
        isConnected: jest.fn().mockReturnValue(true),
        close: jest.fn().mockResolvedValue(undefined),
        send: jest.fn().mockResolvedValue(undefined),
        receive: jest.fn()
      };

      (StdioTransport as any).mockImplementation(() => mockTransport);

      const config: MCPServerConfig = {
        name: 'test-server',
        command: 'node',
        args: ['server.js']
      };

      await client.connect(config);
      
      // Mock the sendRequest to handle tool call
      const mcpClient = client as any;
      mcpClient.sendRequest = jest.fn().mockResolvedValue({
        jsonrpc: '2.0',
        id: 3,
        result: { content: [{ type: 'text', text: 'Result' }] }
      });
      
      const result = await client.callTool('test-server', 'test_tool', { query: 'test' });

      expect(result).toBeDefined();
    });

    it('should throw error if tool call fails', async () => {
      const mockTransport = {
        connect: jest.fn().mockResolvedValue(undefined),
        sendRequest: jest.fn()
          .mockResolvedValueOnce({
            jsonrpc: '2.0',
            id: 1,
            result: {
              protocolVersion: '2024-11-05',
              capabilities: {},
              serverInfo: { name: 'test', version: '1.0.0' }
            }
          })
          .mockResolvedValueOnce({
            jsonrpc: '2.0',
            id: 2,
            error: { code: -1, message: 'Tool not found' }
          }),
        isConnected: jest.fn().mockReturnValue(true),
        close: jest.fn().mockResolvedValue(undefined),
        send: jest.fn().mockResolvedValue(undefined),
        receive: jest.fn()
      };

      (StdioTransport as any).mockImplementation(() => mockTransport);

      const config: MCPServerConfig = {
        name: 'test-server',
        command: 'node',
        args: ['server.js']
      };

      await client.connect(config);

      // Mock the sendRequest to return error
      const mcpClient = client as any;
      mcpClient.sendRequest = jest.fn().mockResolvedValue({
        jsonrpc: '2.0',
        id: 2,
        error: { code: -1, message: 'Tool not found' }
      });

      await expect(
        client.callTool('test-server', 'invalid_tool', {})
      ).rejects.toThrow('MCP tool error');
    });
  });

  describe('getTools', () => {
    it('should return all registered tools', async () => {
      const mockTransport = {
        connect: jest.fn().mockResolvedValue(undefined),
        sendRequest: jest.fn()
          .mockResolvedValueOnce({
            jsonrpc: '2.0',
            id: 1,
            result: {
              protocolVersion: '2024-11-05',
              capabilities: {},
              serverInfo: { name: 'test', version: '1.0.0' }
            }
          })
          .mockResolvedValueOnce({
            jsonrpc: '2.0',
            id: 2,
            result: {
              tools: [
                {
                  name: 'tool1',
                  description: 'Tool 1',
                  inputSchema: {
                    type: 'object',
                    properties: {},
                    required: []
                  }
                },
                {
                  name: 'tool2',
                  description: 'Tool 2',
                  inputSchema: {
                    type: 'object',
                    properties: {},
                    required: []
                  }
                }
              ]
            }
          }),
        isConnected: jest.fn().mockReturnValue(true),
        close: jest.fn().mockResolvedValue(undefined),
        send: jest.fn().mockResolvedValue(undefined),
        receive: jest.fn()
      };

      (StdioTransport as any).mockImplementation(() => mockTransport);

      const config: MCPServerConfig = {
        name: 'test-server',
        command: 'node',
        args: ['server.js']
      };

      await client.connect(config);
      const tools = client.getTools();

      expect(tools).toHaveLength(2);
      expect(tools[0].name).toBe('tool1');
      expect(tools[1].name).toBe('tool2');
    });
  });

  describe('disconnect', () => {
    it('should disconnect from server', async () => {
      const mockTransport = {
        connect: jest.fn().mockResolvedValue(undefined),
        sendRequest: jest.fn().mockResolvedValue({
          jsonrpc: '2.0',
          id: 1,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            serverInfo: { name: 'test', version: '1.0.0' }
          }
        }),
        isConnected: jest.fn().mockReturnValue(true),
        close: jest.fn().mockResolvedValue(undefined),
        send: jest.fn().mockResolvedValue(undefined),
        receive: jest.fn()
      };

      (StdioTransport as any).mockImplementation(() => mockTransport);

      const config: MCPServerConfig = {
        name: 'test-server',
        command: 'node',
        args: ['server.js']
      };

      await client.connect(config);
      
      // Manually set transport for testing
      const mcpClient = client as any;
      mcpClient.transports.set('test-server', mockTransport);
      
      await client.disconnect('test-server');

      expect(mockTransport.close).toHaveBeenCalled();
    });
  });
});

