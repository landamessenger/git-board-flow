/**
 * SubAgent Tester Commands
 * CLI commands for testing SubAgent functionality
 */

import { Command } from 'commander';
import { Agent } from './agent/core/agent';
import { ReadFileTool } from './agent/tools/builtin_tools/read_file_tool';
import { SearchFilesTool } from './agent/tools/builtin_tools/search_files_tool';
import { ProposeChangeTool } from './agent/tools/builtin_tools/propose_change_tool';
import { Task } from './agent/core/subagent_manager';
import { logInfo, logError } from './utils/logger';

export function registerSubAgentTestCommands(program: Command) {
  /**
   * Test creating a subagent
   */
  program
    .command('agent:test-subagent-create')
    .description('Test creating a subagent')
    .option('-m, --model <model>', 'OpenCode model', process.env.OPENCODE_MODEL || 'openai/gpt-4o-mini')
    .option('-k, --opencode-server-url <key>', 'OpenCode server URL', process.env.OPENCODE_SERVER_URL)
    .option('-n, --name <name>', 'SubAgent name', 'test-subagent')
    .option('-p, --prompt <prompt>', 'System prompt', 'You are a helpful assistant')
    .option('-q, --query <query>', 'Test query', 'Hello, introduce yourself')
    .action(async (options) => {
      if (!options.opencodeServerUrl) {
        logError('❌ API key required. Set OPENCODE_SERVER_URL or use --opencode-server-url');
        process.exit(1);
      }

      try {
        logInfo('🤖 Testing subagent creation...');

        const mainAgent = new Agent({
          model: options.model,
          serverUrl: options.opencodeServerUrl,
          maxTurns: 3
        });

        logInfo(`📝 Creating subagent: ${options.name}`);
        const subAgent = mainAgent.createSubAgent({
          name: options.name,
          systemPrompt: options.prompt,
          inheritContext: false
        });

        logInfo(`✅ SubAgent created: ${options.name}`);
        logInfo(`📦 Available tools: ${subAgent.getAvailableTools().join(', ')}`);

        if (options.query) {
          logInfo(`💬 Testing query: ${options.query}`);
          const result = await subAgent.query(options.query);
          logInfo(`✅ Query completed`);
          logInfo(`📝 Response: ${result.finalResponse}`);
        }

        logInfo('✅ SubAgent creation test completed');
      } catch (error: any) {
        logError(`❌ SubAgent test failed: ${error.message}`);
        process.exit(1);
      }
    });

  /**
   * Test parallel execution
   */
  program
    .command('agent:test-subagent-parallel')
    .description('Test parallel execution with subagents')
    .option('-m, --model <model>', 'OpenCode model', process.env.OPENCODE_MODEL || 'openai/gpt-4o-mini')
    .option('-k, --opencode-server-url <key>', 'OpenCode server URL', process.env.OPENCODE_SERVER_URL)
    .option('--max-turns <number>', 'Max turns per agent', '3')
    .action(async (options) => {
      if (!options.opencodeServerUrl) {
        logError('❌ API key required. Set OPENCODE_SERVER_URL or use --opencode-server-url');
        process.exit(1);
      }

      try {
        logInfo('🚀 Testing parallel execution with subagents...');

        const mainAgent = new Agent({
          model: options.model,
          serverUrl: options.opencodeServerUrl,
          maxTurns: parseInt(options.maxTurns)
        });

        const tasks: Task[] = [
          {
            name: 'analyzer',
            prompt: 'Explain what AI is in one sentence',
            systemPrompt: 'You are an AI expert'
          },
          {
            name: 'coder',
            prompt: 'Write a hello world function in JavaScript',
            systemPrompt: 'You are a coding expert'
          },
          {
            name: 'writer',
            prompt: 'Write a short poem about programming',
            systemPrompt: 'You are a creative writer'
          }
        ];

        logInfo(`📋 Executing ${tasks.length} tasks in parallel...`);
        const startTime = Date.now();

        const results = await mainAgent.executeParallel(tasks);

        const duration = Date.now() - startTime;
        logInfo(`✅ All tasks completed in ${duration}ms`);

        for (const { task, result } of results) {
          logInfo(`\n📝 Task: ${task}`);
          logInfo(`Response: ${result.finalResponse.substring(0, 100)}...`);
        }

        logInfo('✅ Parallel execution test completed');
      } catch (error: any) {
        logError(`❌ Parallel execution test failed: ${error.message}`);
        process.exit(1);
      }
    });

  /**
   * Test coordinated execution with dependencies
   */
  program
    .command('agent:test-subagent-coordinate')
    .description('Test coordinated execution with dependencies')
    .option('-m, --model <model>', 'OpenCode model', process.env.OPENCODE_MODEL || 'openai/gpt-4o-mini')
    .option('-k, --opencode-server-url <key>', 'OpenCode server URL', process.env.OPENCODE_SERVER_URL)
    .option('--max-turns <number>', 'Max turns per agent', '3')
    .action(async (options) => {
      if (!options.opencodeServerUrl) {
        logError('❌ API key required. Set OPENCODE_SERVER_URL or use --opencode-server-url');
        process.exit(1);
      }

      try {
        logInfo('🎯 Testing coordinated execution with dependencies...');

        const mainAgent = new Agent({
          model: options.model,
          serverUrl: options.opencodeServerUrl,
          maxTurns: parseInt(options.maxTurns)
        });

        const tasks: Array<Task & { dependsOn?: string[] }> = [
          {
            name: 'analyzer',
            prompt: 'What is the capital of France?',
            systemPrompt: 'You are a geography expert'
          },
          {
            name: 'summarizer',
            prompt: 'Summarize the previous answer in one word',
            systemPrompt: 'You are a summarization expert',
            dependsOn: ['analyzer']
          },
          {
            name: 'formatter',
            prompt: 'Format the summary as: "Answer: [summary]"',
            systemPrompt: 'You are a formatting expert',
            dependsOn: ['summarizer']
          }
        ];

        logInfo(`📋 Executing ${tasks.length} tasks with dependencies...`);
        const startTime = Date.now();

        const results = await mainAgent.coordinateAgents(tasks);

        const duration = Date.now() - startTime;
        logInfo(`✅ All coordinated tasks completed in ${duration}ms`);

        for (const { task, result } of results) {
          logInfo(`\n📝 Task: ${task}`);
          logInfo(`Response: ${result.finalResponse.substring(0, 100)}...`);
        }

        logInfo('✅ Coordinated execution test completed');
      } catch (error: any) {
        logError(`❌ Coordinated execution test failed: ${error.message}`);
        process.exit(1);
      }
    });

  /**
   * Test context sharing between subagents
   */
  program
    .command('agent:test-subagent-context')
    .description('Test context sharing between subagents')
    .option('-m, --model <model>', 'OpenCode model', process.env.OPENCODE_MODEL || 'openai/gpt-4o-mini')
    .option('-k, --opencode-server-url <key>', 'OpenCode server URL', process.env.OPENCODE_SERVER_URL)
    .action(async (options) => {
      if (!options.opencodeServerUrl) {
        logError('❌ API key required. Set OPENCODE_SERVER_URL or use --opencode-server-url');
        process.exit(1);
      }

      try {
        logInfo('📤 Testing context sharing between subagents...');

        const mainAgent = new Agent({
          model: options.model,
          serverUrl: options.opencodeServerUrl,
          maxTurns: 2
        });

        // Create first subagent
        const agent1 = mainAgent.createSubAgent({
          name: 'agent1',
          systemPrompt: 'You are agent 1'
        });

        logInfo('💬 Agent 1: Asking question...');
        await agent1.query('My name is Alice. Remember this.');

        // Create second subagent
        const agent2 = mainAgent.createSubAgent({
          name: 'agent2',
          systemPrompt: 'You are agent 2',
          inheritContext: true
        });

        logInfo('💬 Agent 2: Asking about context...');
        const result = await agent2.query('What is my name?');

        logInfo(`✅ Context sharing test completed`);
        logInfo(`📝 Agent 2 response: ${result.finalResponse}`);

        // Test explicit context sharing
        const subAgentManager = mainAgent.getSubAgentManager();
        if (subAgentManager) {
          logInfo('📤 Testing explicit context sharing...');
          subAgentManager.shareContext('agent1', 'agent2');
          logInfo('✅ Explicit context sharing completed');
        }
      } catch (error: any) {
        logError(`❌ Context sharing test failed: ${error.message}`);
        process.exit(1);
      }
    });

  /**
   * Test subagent with tools
   */
  program
    .command('agent:test-subagent-tools')
    .description('Test subagent with specific tools')
    .option('-m, --model <model>', 'OpenCode model', process.env.OPENCODE_MODEL || 'openai/gpt-4o-mini')
    .option('-k, --opencode-server-url <key>', 'OpenCode server URL', process.env.OPENCODE_SERVER_URL)
    .action(async (options) => {
      if (!options.opencodeServerUrl) {
        logError('❌ API key required. Set OPENCODE_SERVER_URL or use --opencode-server-url');
        process.exit(1);
      }

      try {
        logInfo('🔧 Testing subagent with specific tools...');

        const mainAgent = new Agent({
          model: options.model,
          serverUrl: options.opencodeServerUrl,
          maxTurns: 5
        });

        // Create subagent with only search tool
        const searchAgent = mainAgent.createSubAgent({
          name: 'searcher',
          systemPrompt: 'You are a search expert. Use search_files to find information.',
          tools: [
            new SearchFilesTool({
              searchFiles: () => [],
              getAllFiles: () => ['file1.ts', 'file2.ts', 'file3.ts']
            })
          ]
        });

        logInfo(`📦 Searcher tools: ${searchAgent.getAvailableTools().join(', ')}`);

        // Create subagent with only read tool
        const readAgent = mainAgent.createSubAgent({
          name: 'reader',
          systemPrompt: 'You are a reading expert. Use read_file to read files.',
          tools: [
            new ReadFileTool({
              getFileContent: () => '',
              repositoryFiles: new Map([['file1.ts', 'content']])
            })
          ]
        });

        logInfo(`📦 Reader tools: ${readAgent.getAvailableTools().join(', ')}`);

        logInfo('✅ SubAgent tools test completed');
      } catch (error: any) {
        logError(`❌ SubAgent tools test failed: ${error.message}`);
        process.exit(1);
      }
    });
}

