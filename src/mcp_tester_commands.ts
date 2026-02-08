/**
 * MCP Tester Commands
 * CLI commands for testing MCP functionality
 */

import { Command } from 'commander';
import { Agent } from './agent/core/agent';
import { ReadFileTool } from './agent/tools/builtin_tools/read_file_tool';
import { SearchFilesTool } from './agent/tools/builtin_tools/search_files_tool';
import { MCPServerConfig } from './agent/mcp/types';
import { logInfo, logError } from './utils/logger';

export function registerMCPTestCommands(program: Command) {
  /**
   * Test MCP connection (stdio)
   */
  program
    .command('agent:test-mcp-stdio')
    .description('Test MCP connection via stdio transport')
    .option('-m, --model <model>', 'OpenCode model', process.env.OPENCODE_MODEL || 'openai/gpt-4o-mini')
    .option('-k, --opencode-server-url <key>', 'OpenCode server URL', process.env.OPENCODE_SERVER_URL)
    .option('-c, --command <command>', 'MCP server command', 'node')
    .option('-a, --args <args...>', 'MCP server arguments', [])
    .option('-p, --prompt <prompt>', 'Test prompt', 'List available tools')
    .action(async (options) => {
      if (!options.opencodeServerUrl) {
        logError('❌ API key required. Set OPENCODE_SERVER_URL or use --opencode-server-url');
        process.exit(1);
      }

      let agent: Agent | undefined;
      
      try {
        logInfo('🔌 Testing MCP stdio connection...');

        agent = new Agent({
          model: options.model,
          serverUrl: options.opencodeServerUrl,
          enableMCP: true,
          maxTurns: 5
        });

        // Connect to MCP server
        const mcpConfig: MCPServerConfig = {
          name: 'test-stdio',
          command: options.command,
          args: options.args.length > 0 ? options.args : ['--version'],
          transport: 'stdio'
        };

        logInfo(`📡 Connecting to MCP server: ${mcpConfig.command} ${mcpConfig.args?.join(' ')}`);
        await agent.connectMCPServer(mcpConfig);

        logInfo('✅ MCP server connected');
        logInfo(`📦 Available tools: ${agent.getAvailableTools().join(', ')}`);

        // Test query
        if (options.prompt) {
          logInfo(`💬 Testing query: ${options.prompt}`);
          const result = await agent.query(options.prompt);
          logInfo(`✅ Query completed`);
          logInfo(`📝 Response: ${result.finalResponse}`);
        }

        logInfo('✅ MCP stdio test completed');
        
        // Disconnect MCP server
        if (agent) {
          const mcpManager = agent.getMCPManager();
          if (mcpManager) {
            await mcpManager.disconnectServer('test-stdio');
            logInfo('🔌 Disconnected from MCP server');
          }
        }
        
        process.exit(0);
      } catch (error: any) {
        logError(`❌ MCP test failed: ${error.message}`);
        
        // Ensure cleanup on error
        if (agent) {
          try {
            const mcpManager = agent.getMCPManager();
            if (mcpManager) {
              await mcpManager.disconnectServer('test-stdio');
            }
          } catch (cleanupError) {
            // Ignore cleanup errors
          }
        }
        
        process.exit(1);
      }
    });

  /**
   * Test MCP connection (HTTP)
   */
  program
    .command('agent:test-mcp-http')
    .description('Test MCP connection via HTTP transport')
    .option('-m, --model <model>', 'OpenCode model', process.env.OPENCODE_MODEL || 'openai/gpt-4o-mini')
    .option('-k, --opencode-server-url <key>', 'OpenCode server URL', process.env.OPENCODE_SERVER_URL)
    .option('-u, --url <url>', 'MCP server URL', 'https://mcp.example.com')
    .option('-p, --prompt <prompt>', 'Test prompt', 'List available tools')
    .action(async (options) => {
      if (!options.opencodeServerUrl) {
        logError('❌ API key required. Set OPENCODE_SERVER_URL or use --opencode-server-url');
        process.exit(1);
      }

      let agent: Agent | undefined;
      
      try {
        logInfo('🔌 Testing MCP HTTP connection...');

        agent = new Agent({
          model: options.model,
          serverUrl: options.opencodeServerUrl,
          enableMCP: true,
          maxTurns: 5
        });

        // Connect to MCP server
        const mcpConfig: MCPServerConfig = {
          name: 'test-http',
          url: options.url,
          transport: 'http'
        };

        logInfo(`📡 Connecting to MCP server: ${mcpConfig.url}`);
        await agent.connectMCPServer(mcpConfig);

        logInfo('✅ MCP server connected');
        logInfo(`📦 Available tools: ${agent.getAvailableTools().join(', ')}`);

        // Test query
        if (options.prompt) {
          logInfo(`💬 Testing query: ${options.prompt}`);
          const result = await agent.query(options.prompt);
          logInfo(`✅ Query completed`);
          logInfo(`📝 Response: ${result.finalResponse}`);
        }

        logInfo('✅ MCP HTTP test completed');
        
        // Disconnect MCP server
        if (agent) {
          const mcpManager = agent.getMCPManager();
          if (mcpManager) {
            await mcpManager.disconnectServer('test-http');
            logInfo('🔌 Disconnected from MCP server');
          }
        }
        
        process.exit(0);
      } catch (error: any) {
        logError(`❌ MCP test failed: ${error.message}`);
        logInfo('ℹ️ Note: HTTP MCP servers require a valid endpoint');
        
        // Ensure cleanup on error
        if (agent) {
          try {
            const mcpManager = agent.getMCPManager();
            if (mcpManager) {
              await mcpManager.disconnectServer('test-http');
            }
          } catch (cleanupError) {
            // Ignore cleanup errors
          }
        }
        
        process.exit(1);
      }
    });

  /**
   * Test MCP with config file
   */
  program
    .command('agent:test-mcp-config')
    .description('Test MCP with .mcp.json config file')
    .option('-m, --model <model>', 'OpenCode model', process.env.OPENCODE_MODEL || 'openai/gpt-4o-mini')
    .option('-k, --opencode-server-url <key>', 'OpenCode server URL', process.env.OPENCODE_SERVER_URL)
    .option('-c, --config <path>', 'MCP config path', '.mcp.json')
    .option('-p, --prompt <prompt>', 'Test prompt', 'List available tools')
    .action(async (options) => {
      if (!options.opencodeServerUrl) {
        logError('❌ API key required. Set OPENCODE_SERVER_URL or use --opencode-server-url');
        process.exit(1);
      }

      let agent: Agent | undefined;
      
      try {
        logInfo('🔌 Testing MCP with config file...');

        agent = new Agent({
          model: options.model,
          serverUrl: options.opencodeServerUrl,
          enableMCP: true,
          maxTurns: 5
        });

        logInfo(`📂 Loading MCP config from: ${options.config}`);
        await agent.initializeMCP(options.config);

        const connectedServers = agent.getConnectedMCPServers();
        logInfo(`✅ Connected to ${connectedServers.length} MCP server(s): ${connectedServers.join(', ')}`);
        logInfo(`📦 Available tools: ${agent.getAvailableTools().join(', ')}`);

        // Test query
        if (options.prompt) {
          logInfo(`💬 Testing query: ${options.prompt}`);
          const result = await agent.query(options.prompt);
          logInfo(`✅ Query completed`);
          logInfo(`📝 Response: ${result.finalResponse}`);
        }

        logInfo('✅ MCP config test completed');
        
        // Disconnect all MCP servers
        if (agent) {
          const mcpManager = agent.getMCPManager();
          if (mcpManager) {
            await mcpManager.disconnectAll();
            logInfo('🔌 Disconnected from all MCP servers');
          }
        }
        
        // Exit process to ensure cleanup
        process.exit(0);
      } catch (error: any) {
        logError(`❌ MCP config test failed: ${error.message}`);
        logInfo('ℹ️ Create a .mcp.json file with MCP server configurations');
        
        // Ensure cleanup on error
        if (agent) {
          try {
            const mcpManager = agent.getMCPManager();
            if (mcpManager) {
              await mcpManager.disconnectAll();
            }
          } catch (cleanupError) {
            // Ignore cleanup errors
          }
        }
        
        process.exit(1);
      }
    });

  /**
   * Test MCP tool execution
   */
  program
    .command('agent:test-mcp-tool')
    .description('Test MCP tool execution')
    .option('-m, --model <model>', 'OpenCode model', process.env.OPENCODE_MODEL || 'openai/gpt-4o-mini')
    .option('-k, --opencode-server-url <key>', 'OpenCode server URL', process.env.OPENCODE_SERVER_URL)
    .option('-s, --server <name>', 'MCP server name', 'test-server')
    .option('-t, --tool <name>', 'Tool name to test')
    .option('-i, --input <json>', 'Tool input as JSON', '{}')
    .action(async (options) => {
      if (!options.opencodeServerUrl) {
        logError('❌ API key required. Set OPENCODE_SERVER_URL or use --opencode-server-url');
        process.exit(1);
      }

      if (!options.tool) {
        logError('❌ Tool name required. Use -t flag');
        process.exit(1);
      }

      try {
        logInfo('🔧 Testing MCP tool execution...');

        const agent = new Agent({
          model: options.model,
          serverUrl: options.opencodeServerUrl,
          enableMCP: true
        });

        const mcpManager = agent.getMCPManager();
        if (!mcpManager) {
          throw new Error('MCP manager not initialized');
        }

        const client = mcpManager.getClient();
        const input = JSON.parse(options.input);

        logInfo(`🔧 Calling tool: ${options.server}:${options.tool}`);
        logInfo(`📥 Input: ${JSON.stringify(input, null, 2)}`);

        const result = await client.callTool(options.server, options.tool, input);

        logInfo(`✅ Tool executed successfully`);
        logInfo(`📤 Result: ${JSON.stringify(result, null, 2)}`);
      } catch (error: any) {
        logError(`❌ MCP tool test failed: ${error.message}`);
        process.exit(1);
      }
    });
}

