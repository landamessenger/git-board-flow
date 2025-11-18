#!/usr/bin/env node

import { execSync } from 'child_process';
import { Command } from 'commander';
import * as dotenv from 'dotenv';
import { ERRORS } from './utils/constants';

// Load environment variables from .env file
dotenv.config();

const program = new Command();

// Function to get git repository info
function getGitInfo() {
  try {
    const remoteUrl = execSync('git config --get remote.origin.url').toString().trim();
    const match = remoteUrl.match(/github\.com[/:]([^/]+)\/([^/]+)(?:\.git)?$/);
    if (!match) {
      return { error: ERRORS.GIT_REPOSITORY_NOT_FOUND };
    }
    return {
      owner: match[1],
      repo: match[2].replace('.git', '')
    };
  } catch (error) {
    return { error: ERRORS.GIT_REPOSITORY_NOT_FOUND };
  }
}

/**
 * Test Agent SDK - Simple test without tools
 */
program
  .command('agent:test-simple')
  .description('Test Agent SDK with a simple prompt (no tools)')
  .option('-p, --prompt <prompt>', 'Prompt to send', 'Hello, can you introduce yourself?')
  .option('-m, --model <model>', 'OpenRouter model', process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini')
  .option('-k, --api-key <key>', 'OpenRouter API key', process.env.OPENROUTER_API_KEY)
  .option('--max-turns <number>', 'Maximum turns', '5')
  .action(async (options) => {
    if (!options.apiKey) {
      console.error('❌ Error: OpenRouter API key is required');
      console.error('   Set OPENROUTER_API_KEY environment variable or use --api-key');
      process.exit(1);
    }

    const { Agent } = await import('./agent/core/agent');
    
    console.log('🤖 Starting Agent SDK simple test...\n');
    console.log(`📝 Prompt: ${options.prompt}`);
    console.log(`🔧 Model: ${options.model}\n`);

    const agent = new Agent({
      model: options.model,
      apiKey: options.apiKey,
      systemPrompt: 'You are a helpful AI assistant. Be concise and clear.',
      maxTurns: parseInt(options.maxTurns) || 5,
      onTurnComplete: (turn) => {
        console.log(`\n🔄 Turn ${turn.turnNumber} completed`);
        if (turn.toolCalls.length > 0) {
          console.log(`   Tools called: ${turn.toolCalls.map(tc => tc.name).join(', ')}`);
        }
      }
    });

    try {
      const result = await agent.query(options.prompt);
      
      console.log('\n✅ Agent execution completed\n');
      console.log('📊 Results:');
      console.log(`   Turns: ${result.turns.length}`);
      console.log(`   Tool calls: ${result.toolCalls.length}`);
      console.log(`   Final response:\n`);
      console.log(result.finalResponse);
      
      if (result.error) {
        console.error(`\n❌ Error: ${result.error.message}`);
      }
    } catch (error) {
      console.error(`\n❌ Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

/**
 * Test Agent SDK - With file reading tool
 */
program
  .command('agent:test-file')
  .description('Test Agent SDK with file reading tool')
  .option('-p, --prompt <prompt>', 'Prompt to send', 'Read the package.json file and tell me what dependencies are used')
  .option('-m, --model <model>', 'OpenRouter model', process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini')
  .option('-k, --api-key <key>', 'OpenRouter API key', process.env.OPENROUTER_API_KEY)
  .option('--max-turns <number>', 'Maximum turns', '10')
  .action(async (options) => {
    if (!options.apiKey) {
      console.error('❌ Error: OpenRouter API key is required');
      process.exit(1);
    }

    const { Agent } = await import('./agent/core/agent');
    const { ReadFileTool } = await import('./agent/tools/builtin_tools/read_file_tool');
    const { FileRepository } = await import('./data/repository/file_repository');
    const fs = await import('fs/promises');
    const path = await import('path');
    
    console.log('🤖 Starting Agent SDK file reading test...\n');
    console.log(`📝 Prompt: ${options.prompt}`);
    console.log(`🔧 Model: ${options.model}\n`);

    // Load repository files
    const fileRepo = new FileRepository();
    const gitInfo = getGitInfo();
    
    if ('error' in gitInfo) {
      console.error('❌ Error: Not in a git repository');
      process.exit(1);
    }

    const token = process.env.PERSONAL_ACCESS_TOKEN || '';
    const branch = 'master';
    
    console.log('📚 Loading repository files...');
    const repositoryFiles = await fileRepo.getRepositoryContent(
      gitInfo.owner,
      gitInfo.repo,
      token,
      branch,
      ['node_modules/*', 'build/*'],
      () => {},
      () => {}
    );
    
    console.log(`✅ Loaded ${repositoryFiles.size} files\n`);

    // Create read file tool
    const readFileTool = new ReadFileTool({
      getFileContent: (filePath: string) => repositoryFiles.get(filePath),
      repositoryFiles: repositoryFiles
    });

    const agent = new Agent({
      model: options.model,
      apiKey: options.apiKey,
      systemPrompt: 'You are a helpful AI assistant that can read files from a codebase. When asked about files, use the read_file tool to examine them.',
      maxTurns: parseInt(options.maxTurns) || 10,
      tools: [readFileTool],
      onTurnComplete: (turn) => {
        console.log(`\n🔄 Turn ${turn.turnNumber} completed`);
        if (turn.toolCalls.length > 0) {
          console.log(`   Tools called: ${turn.toolCalls.map(tc => `${tc.name}(${JSON.stringify(tc.input)})`).join(', ')}`);
        }
      },
      onToolCall: (toolCall) => {
        console.log(`   🔧 Tool call: ${toolCall.name}`);
      }
    });

    try {
      const result = await agent.query(options.prompt);
      
      console.log('\n✅ Agent execution completed\n');
      console.log('📊 Results:');
      console.log(`   Turns: ${result.turns.length}`);
      console.log(`   Tool calls: ${result.toolCalls.length}`);
      console.log(`   Final response:\n`);
      console.log(result.finalResponse);
      
      if (result.error) {
        console.error(`\n❌ Error: ${result.error.message}`);
      }
    } catch (error) {
      console.error(`\n❌ Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

/**
 * Test Agent SDK - Full test with all tools
 */
program
  .command('agent:test-full')
  .description('Test Agent SDK with all built-in tools (read_file, search_files, propose_change, manage_todos)')
  .option('-p, --prompt <prompt>', 'Prompt to send', 'Analyze the codebase structure and create a TODO list for improvements')
  .option('-m, --model <model>', 'OpenRouter model', process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini')
  .option('-k, --api-key <key>', 'OpenRouter API key', process.env.OPENROUTER_API_KEY)
  .option('--max-turns <number>', 'Maximum turns', '20')
  .action(async (options) => {
    if (!options.apiKey) {
      console.error('❌ Error: OpenRouter API key is required');
      process.exit(1);
    }

    const { Agent } = await import('./agent/core/agent');
    const { ReadFileTool } = await import('./agent/tools/builtin_tools/read_file_tool');
    const { SearchFilesTool } = await import('./agent/tools/builtin_tools/search_files_tool');
    const { ProposeChangeTool } = await import('./agent/tools/builtin_tools/propose_change_tool');
    const { ManageTodosTool } = await import('./agent/tools/builtin_tools/manage_todos_tool');
    const { FileRepository } = await import('./data/repository/file_repository');
    const { ThinkCodeManager } = await import('./usecase/steps/common/think_code_manager');
    const { ThinkTodoManager } = await import('./usecase/steps/common/think_todo_manager');
    const { FileSearchService } = await import('./usecase/steps/common/services/file_search_service');
    
    console.log('🤖 Starting Agent SDK full test...\n');
    console.log(`📝 Prompt: ${options.prompt}`);
    console.log(`🔧 Model: ${options.model}\n`);

    // Load repository files
    const fileRepo = new FileRepository();
    const gitInfo = getGitInfo();
    
    if ('error' in gitInfo) {
      console.error('❌ Error: Not in a git repository');
      process.exit(1);
    }

    const token = process.env.PERSONAL_ACCESS_TOKEN || '';
    const branch = 'master';
    
    console.log('📚 Loading repository files...');
    const repositoryFiles = await fileRepo.getRepositoryContent(
      gitInfo.owner,
      gitInfo.repo,
      token,
      branch,
      ['node_modules/*', 'build/*'],
      () => {},
      () => {}
    );
    
    console.log(`✅ Loaded ${repositoryFiles.size} files\n`);

    // Initialize managers
    const codeManager = new ThinkCodeManager();
    codeManager.initialize(repositoryFiles);
    const todoManager = new ThinkTodoManager();
    const fileSearchService = new FileSearchService();
    const fileIndex = fileSearchService.buildFileIndex(repositoryFiles);

    // Create tools
    const readFileTool = new ReadFileTool({
      getFileContent: (filePath: string) => codeManager.getFileContent(filePath),
      repositoryFiles: repositoryFiles
    });

    const searchFilesTool = new SearchFilesTool({
      searchFiles: (query: string) => {
        // Simple search implementation
        const results: string[] = [];
        const queryLower = query.toLowerCase();
        
        for (const filePath of repositoryFiles.keys()) {
          if (filePath.toLowerCase().includes(queryLower)) {
            results.push(filePath);
          }
        }
        
        return results;
      },
      getAllFiles: () => Array.from(repositoryFiles.keys())
    });

    const proposeChangeTool = new ProposeChangeTool({
      applyChange: (change) => {
        return codeManager.applyChange({
          file_path: change.file_path,
          change_type: change.change_type,
          description: change.description,
          suggested_code: change.suggested_code,
          reasoning: change.reasoning
        });
      }
    });

    const manageTodosTool = new ManageTodosTool({
      createTodo: (content, status) => todoManager.createTodo(content, status),
      updateTodo: (id, updates) => {
        return todoManager.updateTodo(id, {
          status: updates.status,
          notes: updates.notes,
          related_files: updates.related_files,
          related_changes: updates.related_changes
        });
      },
      getAllTodos: () => todoManager.getAllTodos(),
      getActiveTodos: () => todoManager.getActiveTodos()
    });

    const agent = new Agent({
      model: options.model,
      apiKey: options.apiKey,
      systemPrompt: `You are an advanced code analysis assistant similar to Claude Code. You have access to tools to:
- Read files from the repository
- Search for files by name or content
- Propose changes to files (changes are applied in a virtual codebase)
- Manage a TODO list to track tasks

**CRITICAL - Tool Usage Instructions:**

1. **read_file**: Always provide "file_path" in the input. Example: {"file_path": "README.md"}

2. **manage_todos**: 
   - To CREATE: Use action="create" with "content" field (the task description). Example: {"action": "create", "content": "Improve documentation", "status": "pending"}
   - To UPDATE: Use action="update" with "todo_id" and "status" or "notes". Example: {"action": "update", "todo_id": "todo_1", "status": "completed"}
   - To LIST: Use action="list". Example: {"action": "list"}

3. **propose_change**: Provide file_path, change_type, description, suggested_code, and reasoning.

4. **search_files**: Provide "query" field. Example: {"query": "test"}

**IMPORTANT**: Always check the tool's required fields before calling it. If a tool call fails, read the error message carefully and fix the input format.

Use these tools systematically to analyze code and propose improvements.`,
      maxTurns: parseInt(options.maxTurns) || 20,
      tools: [readFileTool, searchFilesTool, proposeChangeTool, manageTodosTool],
      onTurnComplete: (turn) => {
        console.log(`\n🔄 Turn ${turn.turnNumber} completed`);
        if (turn.toolCalls.length > 0) {
          console.log(`   Tools: ${turn.toolCalls.map(tc => tc.name).join(', ')}`);
        }
        if (turn.reasoning) {
          console.log(`   Reasoning: ${turn.reasoning.substring(0, 100)}...`);
        }
      }
    });

    try {
      const result = await agent.query(options.prompt);
      
      console.log('\n✅ Agent execution completed\n');
      console.log('📊 Results:');
      console.log(`   Turns: ${result.turns.length}`);
      console.log(`   Tool calls: ${result.toolCalls.length}`);
      console.log(`   TODOs: ${todoManager.getStats().total}`);
      console.log(`   Changes: ${codeManager.getStats().totalChanges}`);
      console.log(`\n📝 Final response:\n`);
      console.log(result.finalResponse);
      
      if (result.error) {
        console.error(`\n❌ Error: ${result.error.message}`);
      }
    } catch (error) {
      console.error(`\n❌ Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

/**
 * Test Agent SDK - Streaming
 */
program
  .command('agent:test-streaming')
  .description('Test Agent SDK with streaming enabled')
  .option('-p, --prompt <prompt>', 'Prompt to send', 'Tell me a short story')
  .option('-m, --model <model>', 'OpenRouter model', process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini')
  .option('-k, --api-key <key>', 'OpenRouter API key', process.env.OPENROUTER_API_KEY)
  .action(async (options) => {
    if (!options.apiKey) {
      console.error('❌ Error: OpenRouter API key is required');
      process.exit(1);
    }

    const { Agent } = await import('./agent/core/agent');
    
    console.log('🌊 Testing Agent SDK with streaming...\n');
    console.log(`📝 Prompt: ${options.prompt}`);
    console.log(`🔧 Model: ${options.model}\n`);

    const agent = new Agent({
      model: options.model,
      apiKey: options.apiKey,
      streaming: true,
      onStreamChunk: (chunk) => {
        process.stdout.write(chunk.content);
      }
    });

    const result = await agent.query(options.prompt);
    
    console.log('\n\n✅ Streaming test completed!');
    console.log(`📊 Turns: ${result.turns.length}`);
    if (result.metrics) {
      console.log(`📊 Tokens: ${result.metrics.totalTokens.input + result.metrics.totalTokens.output}`);
    }
  });

/**
 * Test Agent SDK - Permissions
 */
program
  .command('agent:test-permissions')
  .description('Test Agent SDK with tool permissions (blocklist)')
  .option('-p, --prompt <prompt>', 'Prompt to send', 'Read README.md and create a TODO')
  .option('-m, --model <model>', 'OpenRouter model', process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini')
  .option('-k, --api-key <key>', 'OpenRouter API key', process.env.OPENROUTER_API_KEY)
  .action(async (options) => {
    if (!options.apiKey) {
      console.error('❌ Error: OpenRouter API key is required');
      process.exit(1);
    }

    const { Agent } = await import('./agent/core/agent');
    const { ReadFileTool } = await import('./agent/tools/builtin_tools/read_file_tool');
    const { ManageTodosTool } = await import('./agent/tools/builtin_tools/manage_todos_tool');
    const { FileRepository } = await import('./data/repository/file_repository');
    const { ThinkCodeManager } = await import('./usecase/steps/common/think_code_manager');
    const { ThinkTodoManager } = await import('./usecase/steps/common/think_todo_manager');
    
    console.log('🔒 Testing Agent SDK with permissions (blocklist: manage_todos)...\n');
    console.log(`📝 Prompt: ${options.prompt}`);
    console.log(`🔧 Model: ${options.model}\n`);

    const fileRepo = new FileRepository();
    const gitInfo = getGitInfo();
    
    if ('error' in gitInfo) {
      console.error('❌ Error: Not in a git repository');
      process.exit(1);
    }

    const token = process.env.PERSONAL_ACCESS_TOKEN || '';
    const branch = 'master';
    const repositoryFiles = await fileRepo.getRepositoryContent(
      gitInfo.owner,
      gitInfo.repo,
      token,
      branch,
      [],
      () => {}, // progress callback
      () => {}  // ignoredFiles callback
    );

    const codeManager = new ThinkCodeManager();
    const todoManager = new ThinkTodoManager();

    const readFileTool = new ReadFileTool({
      getFileContent: (filePath: string) => repositoryFiles.get(filePath),
      repositoryFiles: repositoryFiles
    });
    const manageTodosTool = new ManageTodosTool({
      createTodo: (content, status) => todoManager.createTodo(content, status),
      updateTodo: (id, updates) => {
        return todoManager.updateTodo(id, {
          status: updates.status,
          notes: updates.notes,
          related_files: updates.related_files,
          related_changes: updates.related_changes
        });
      },
      getAllTodos: () => todoManager.getAllTodos(),
      getActiveTodos: () => todoManager.getActiveTodos()
    });

    const agent = new Agent({
      model: options.model,
      apiKey: options.apiKey,
      tools: [readFileTool, manageTodosTool],
      toolPermissions: {
        strategy: 'blocklist',
        blocked: ['manage_todos']
      },
      maxTurns: 5
    });

    const result = await agent.query(options.prompt);
    
    console.log('\n✅ Permissions test completed!');
    console.log(`📊 Turns: ${result.turns.length}`);
    console.log(`🔧 Tool calls: ${result.toolCalls.length}`);
    console.log(`🚫 Blocked tools should not appear in tool calls`);
  });

/**
 * Test Agent SDK - Sessions
 */
program
  .command('agent:test-sessions')
  .description('Test Agent SDK with session persistence')
  .option('-m, --model <model>', 'OpenRouter model', process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini')
  .option('-k, --api-key <key>', 'OpenRouter API key', process.env.OPENROUTER_API_KEY)
  .action(async (options) => {
    if (!options.apiKey) {
      console.error('❌ Error: OpenRouter API key is required');
      process.exit(1);
    }

    const { Agent } = await import('./agent/core/agent');
    
    console.log('💾 Testing Agent SDK with sessions...\n');
    console.log(`🔧 Model: ${options.model}\n`);

    const agent = new Agent({
      model: options.model,
      apiKey: options.apiKey,
      persistSession: true
    });

    const sessionId = agent.getSessionId();
    console.log(`📂 Session ID: ${sessionId}\n`);

    // First query
    console.log('📝 First query: "What is 2+2?"');
    const result1 = await agent.query('What is 2+2?');
    console.log(`✅ Response: ${result1.finalResponse}\n`);

    // Continue conversation
    console.log('📝 Second query: "What about 3+3?"');
    const result2 = await agent.continue('What about 3+3?');
    console.log(`✅ Response: ${result2.finalResponse}\n`);

    // List sessions
    const sessions = await agent.listSessions();
    console.log(`📋 Found ${sessions.length} session(s)`);

    console.log('\n✅ Sessions test completed!');
  });

/**
 * Test Agent SDK - Metrics
 */
program
  .command('agent:test-metrics')
  .description('Test Agent SDK with metrics tracking')
  .option('-p, --prompt <prompt>', 'Prompt to send', 'Explain what AI is in one sentence')
  .option('-m, --model <model>', 'OpenRouter model', process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini')
  .option('-k, --api-key <key>', 'OpenRouter API key', process.env.OPENROUTER_API_KEY)
  .action(async (options) => {
    if (!options.apiKey) {
      console.error('❌ Error: OpenRouter API key is required');
      process.exit(1);
    }

    const { Agent } = await import('./agent/core/agent');
    
    console.log('📊 Testing Agent SDK with metrics...\n');
    console.log(`📝 Prompt: ${options.prompt}`);
    console.log(`🔧 Model: ${options.model}\n`);

    let metricsReceived = false;

    const agent = new Agent({
      model: options.model,
      apiKey: options.apiKey,
      trackMetrics: true,
      onMetrics: (metrics) => {
        metricsReceived = true;
        console.log('\n📊 Metrics:');
        console.log(`  API Calls: ${metrics.apiCalls}`);
        console.log(`  Tool Calls: ${metrics.toolCalls}`);
        console.log(`  Input Tokens: ${metrics.totalTokens.input}`);
        console.log(`  Output Tokens: ${metrics.totalTokens.output}`);
        console.log(`  Total Tokens: ${metrics.totalTokens.input + metrics.totalTokens.output}`);
        if (metrics.totalCost) {
          console.log(`  Cost: $${metrics.totalCost.toFixed(4)}`);
        }
        console.log(`  Average Latency: ${metrics.averageLatency}ms`);
        console.log(`  Total Duration: ${metrics.totalDuration}ms`);
        console.log(`  Errors: ${metrics.errors}`);
      }
    });

    const result = await agent.query(options.prompt);
    
    console.log(`\n✅ Response: ${result.finalResponse}`);
    console.log(`\n✅ Metrics test completed!`);
    console.log(`📊 Metrics received: ${metricsReceived ? 'Yes' : 'No'}`);
  });

/**
 * Test Agent SDK - Budget
 */
program
  .command('agent:test-budget')
  .description('Test Agent SDK with budget limits')
  .option('-p, --prompt <prompt>', 'Prompt to send', 'Count to 10')
  .option('-m, --model <model>', 'OpenRouter model', process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini')
  .option('-k, --api-key <key>', 'OpenRouter API key', process.env.OPENROUTER_API_KEY)
  .option('--max-tokens <number>', 'Max tokens budget', '100')
  .action(async (options) => {
    if (!options.apiKey) {
      console.error('❌ Error: OpenRouter API key is required');
      process.exit(1);
    }

    const { Agent } = await import('./agent/core/agent');
    
    console.log('💰 Testing Agent SDK with budget...\n');
    console.log(`📝 Prompt: ${options.prompt}`);
    console.log(`🔧 Model: ${options.model}`);
    console.log(`💰 Max Tokens: ${options.maxTokens}\n`);

    const agent = new Agent({
      model: options.model,
      apiKey: options.apiKey,
      trackMetrics: true,
      budget: {
        maxTokens: parseInt(options.maxTokens),
        warnAtPercent: 50
      }
    });

    const result = await agent.query(options.prompt);
    
    console.log(`\n✅ Response: ${result.finalResponse}`);
    console.log(`\n✅ Budget test completed!`);
    console.log(`💰 Budget exceeded: ${result.budgetExceeded ? 'Yes' : 'No'}`);
    if (result.metrics) {
      const totalTokens = result.metrics.totalTokens.input + result.metrics.totalTokens.output;
      console.log(`📊 Total Tokens: ${totalTokens}/${options.maxTokens}`);
    }
  });

/**
 * Test Agent SDK - Retry
 */
program
  .command('agent:test-retry')
  .description('Test Agent SDK with retry logic')
  .option('-p, --prompt <prompt>', 'Prompt to send', 'Hello')
  .option('-m, --model <model>', 'OpenRouter model', process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini')
  .option('-k, --api-key <key>', 'OpenRouter API key', process.env.OPENROUTER_API_KEY)
  .action(async (options) => {
    if (!options.apiKey) {
      console.error('❌ Error: OpenRouter API key is required');
      process.exit(1);
    }

    const { Agent } = await import('./agent/core/agent');
    
    console.log('🔄 Testing Agent SDK with retry logic...\n');
    console.log(`📝 Prompt: ${options.prompt}`);
    console.log(`🔧 Model: ${options.model}\n`);

    const agent = new Agent({
      model: options.model,
      apiKey: options.apiKey,
      retry: {
        maxRetries: 3,
        initialDelay: 100,
        backoffMultiplier: 2
      }
    });

    const result = await agent.query(options.prompt);
    
    console.log(`\n✅ Response: ${result.finalResponse}`);
    console.log(`\n✅ Retry test completed!`);
    console.log(`📊 Turns: ${result.turns.length}`);
  });

/**
 * Test Agent SDK - All Features
 */
program
  .command('agent:test-all-features')
  .description('Test Agent SDK with all advanced features enabled')
  .option('-p, --prompt <prompt>', 'Prompt to send', 'Explain what AI is')
  .option('-m, --model <model>', 'OpenRouter model', process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini')
  .option('-k, --api-key <key>', 'OpenRouter API key', process.env.OPENROUTER_API_KEY)
  .action(async (options) => {
    if (!options.apiKey) {
      console.error('❌ Error: OpenRouter API key is required');
      process.exit(1);
    }

    const { Agent } = await import('./agent/core/agent');
    
    console.log('🚀 Testing Agent SDK with ALL features...\n');
    console.log(`📝 Prompt: ${options.prompt}`);
    console.log(`🔧 Model: ${options.model}\n`);

    const agent = new Agent({
      model: options.model,
      apiKey: options.apiKey,
      streaming: true,
      persistSession: true,
      trackMetrics: true,
      maxContextLength: 50000,
      contextCompressionEnabled: true,
      budget: {
        maxTokens: 10000,
        warnAtPercent: 80
      },
      timeouts: {
        apiCall: 30000,
        toolExecution: 10000,
        totalSession: 60000
      },
      retry: {
        maxRetries: 3,
        initialDelay: 1000
      },
      onStreamChunk: (chunk) => {
        if (chunk.type === 'text') {
          process.stdout.write(chunk.content);
        }
      },
      onMetrics: (metrics) => {
        console.log(`\n📊 Final Metrics:`);
        console.log(`  Tokens: ${metrics.totalTokens.input + metrics.totalTokens.output}`);
        console.log(`  API Calls: ${metrics.apiCalls}`);
        console.log(`  Duration: ${metrics.totalDuration}ms`);
      }
    });

    const sessionId = agent.getSessionId();
    console.log(`📂 Session ID: ${sessionId}\n`);

    const result = await agent.query(options.prompt);
    
    console.log('\n\n✅ All features test completed!');
    console.log(`📊 Turns: ${result.turns.length}`);
    console.log(`💰 Budget exceeded: ${result.budgetExceeded ? 'Yes' : 'No'}`);
    console.log(`⏱️ Timeout exceeded: ${result.timeoutExceeded ? 'Yes' : 'No'}`);
  });

program.parse(process.argv); 