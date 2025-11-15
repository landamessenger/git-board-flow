#!/usr/bin/env node

import { execSync } from 'child_process';
import { Command } from 'commander';
import * as dotenv from 'dotenv';
import { runLocalAction } from './actions/local_action';
import { IssueRepository } from './data/repository/issue_repository';
import { ACTIONS, COMMAND, ERRORS, INPUT_KEYS, TITLE } from './utils/constants';
import { logInfo } from './utils/logger';

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

program
  .command('build-ai')
  .description(`${TITLE} - Build AI container and execute AI cache indexing`)
  .option('-d, --debug', 'Debug mode', false)
  .option('-t, --token <token>', 'Personal access token', process.env.PERSONAL_ACCESS_TOKEN)
  .action(async (options) => {    
    const gitInfo = getGitInfo();
    
    if ('error' in gitInfo) {
      console.log(gitInfo.error);
      return;
    }
    
    const params: any = {
      [INPUT_KEYS.DEBUG]: options.debug.toString(),
      [INPUT_KEYS.SINGLE_ACTION]: ACTIONS.AI_CACHE_LOCAL,
      [INPUT_KEYS.SINGLE_ACTION_ISSUE]: 1,
      [INPUT_KEYS.SUPABASE_URL]: process.env.SUPABASE_URL,
      [INPUT_KEYS.SUPABASE_KEY]: process.env.SUPABASE_KEY,
      [INPUT_KEYS.OPENROUTER_API_KEY]: process.env.OPENROUTER_API_KEY,
      [INPUT_KEYS.OPENROUTER_MODEL]: process.env.OPENROUTER_MODEL,
      [INPUT_KEYS.TOKEN]: options.token || process.env.PERSONAL_ACCESS_TOKEN,
      [INPUT_KEYS.AI_IGNORE_FILES]: 'build/*',
      repo: {
        owner: gitInfo.owner,
        repo: gitInfo.repo,
      },
      issue: {
        number: 1,
      },
    };

    params[INPUT_KEYS.WELCOME_TITLE] = '🚀 AI Cache Indexing';
    params[INPUT_KEYS.WELCOME_MESSAGES] = [
      `Indexing AI cache for ${gitInfo.owner}/${gitInfo.repo}...`,
    ];

    await runLocalAction(params);
  });

/**
 * Run the thinking AI scenario for deep code analysis and proposals.
 */
program
  .command('think')
  .description(`${TITLE} - Deep code analysis and change proposals using AI reasoning`)
  .option('-i, --issue <number>', 'Issue number to process (optional)', '1')
  .option('-b, --branch <name>', 'Branch name', 'master')
  .option('-d, --debug', 'Debug mode', false)
  .option('-t, --token <token>', 'Personal access token', process.env.PERSONAL_ACCESS_TOKEN)
  .option('-q, --question <question...>', 'Question or prompt for analysis', '')
  .option('--anthropic-api-key <key>', 'Anthropic API key', '')
  .option('--anthropic-model <model>', 'Anthropic model', '')
  .option('--openrouter-api-key <key>', 'OpenRouter API key', '')
  .option('--openrouter-model <model>', 'OpenRouter model', '')
  .option('--openrouter-provider-order <provider>', 'OpenRouter provider', '')
  .option('--openrouter-provider-allow-fallbacks <fallback>', 'OpenRouter fallback', '')
  .option('--openrouter-provider-require-parameters <require>', 'OpenRouter require', '')
  .option('--openrouter-provider-data-collection <collection>', 'OpenRouter collection', '')
  .option('--openrouter-provider-ignore <ignore>', 'OpenRouter ignore', '')
  .option('--openrouter-provider-quantizations <quantizations>', 'OpenRouter quantizations', '')
  .option('--openrouter-provider-sort <sort>', 'OpenRouter sort', '')
  .option('--ai-ignore-files <ai-ignore-files>', 'AI ignore files', 'node_modules/*,build/*')
  .option('--include-reasoning <include-reasoning>', 'Include reasoning', 'false')
  .action(async (options) => {    
    const gitInfo = getGitInfo();
    
    if ('error' in gitInfo) {
      console.log(gitInfo.error);
      return;
    }

    // Helper function to clean CLI arguments that may have '=' prefix
    const cleanArg = (value: any): string => {
      if (!value) return '';
      const str = String(value);
      return str.startsWith('=') ? str.substring(1) : str;
    };

    const questionParts = (options.question || []).map(cleanArg);
    const question = questionParts.join(' ');

    if (!question || question.length === 0) {
      console.log('❌ Please provide a question or prompt using -q or --question');
      return;
    }

    const branch = cleanArg(options.branch);
    const issueNumber = cleanArg(options.issue);

    const params: any = {
      [INPUT_KEYS.DEBUG]: options.debug.toString(),
      [INPUT_KEYS.SINGLE_ACTION]: ACTIONS.THINK,
      [INPUT_KEYS.SINGLE_ACTION_ISSUE]: parseInt(issueNumber) || 1,
      [INPUT_KEYS.SUPABASE_URL]: options?.supabaseUrl?.length > 0 ? options.supabaseUrl : process.env.SUPABASE_URL,
      [INPUT_KEYS.SUPABASE_KEY]: options?.supabaseKey?.length > 0 ? options.supabaseKey : process.env.SUPABASE_KEY,
      [INPUT_KEYS.TOKEN]: options?.token?.length > 0 ? options.token : process.env.PERSONAL_ACCESS_TOKEN,
      [INPUT_KEYS.ANTHROPIC_API_KEY]: options?.anthropicApiKey?.length > 0 ? options.anthropicApiKey : process.env.ANTHROPIC_API_KEY,
      [INPUT_KEYS.ANTHROPIC_MODEL]: options?.anthropicModel?.length > 0 ? options.anthropicModel : process.env.ANTHROPIC_MODEL,
      [INPUT_KEYS.OPENROUTER_API_KEY]: options?.openrouterApiKey?.length > 0 ? options.openrouterApiKey : process.env.OPENROUTER_API_KEY,
      [INPUT_KEYS.OPENROUTER_MODEL]: options?.openrouterModel?.length > 0 ? options.openrouterModel : process.env.OPENROUTER_MODEL,
      [INPUT_KEYS.OPENROUTER_PROVIDER_ORDER]: options?.openrouterProviderOrder?.length > 0 ? options.openrouterProviderOrder : process.env.OPENROUTER_PROVIDER_ORDER,
      [INPUT_KEYS.OPENROUTER_PROVIDER_ALLOW_FALLBACKS]: options?.openrouterProviderAllowFallbacks?.length > 0 ? options.openrouterProviderAllowFallbacks : process.env.OPENROUTER_PROVIDER_ALLOW_FALLBACKS,
      [INPUT_KEYS.OPENROUTER_PROVIDER_REQUIRE_PARAMETERS]: options?.openrouterProviderRequireParameters?.length > 0 ? options.openrouterProviderRequireParameters : process.env.OPENROUTER_PROVIDER_REQUIRE_PARAMETERS,
      [INPUT_KEYS.OPENROUTER_PROVIDER_DATA_COLLECTION]: options?.openrouterProviderDataCollection?.length > 0 ? options.openrouterProviderDataCollection : process.env.OPENROUTER_PROVIDER_DATA_COLLECTION,
      [INPUT_KEYS.OPENROUTER_PROVIDER_IGNORE]: options?.openrouterProviderIgnore?.length > 0 ? options.openrouterProviderIgnore : process.env.OPENROUTER_PROVIDER_IGNORE,
      [INPUT_KEYS.OPENROUTER_PROVIDER_QUANTIZATIONS]: options?.openrouterProviderQuantizations?.length > 0 ? options.openrouterProviderQuantizations : process.env.OPENROUTER_PROVIDER_QUANTIZATIONS,
      [INPUT_KEYS.OPENROUTER_PROVIDER_SORT]: options?.openrouterProviderSort?.length > 0 ? options.openrouterProviderSort : process.env.OPENROUTER_PROVIDER_SORT,
      [INPUT_KEYS.AI_IGNORE_FILES]: options?.aiIgnoreFiles?.length > 0 ? options.aiIgnoreFiles : process.env.AI_IGNORE_FILES,
      [INPUT_KEYS.AI_INCLUDE_REASONING]: options?.includeReasoning?.length > 0 ? options.includeReasoning : process.env.AI_INCLUDE_REASONING,
      repo: {
        owner: gitInfo.owner,
        repo: gitInfo.repo,
      },
      commits: {
        ref: `refs/heads/${branch}`,
      },
    }

    // Set up issue context if provided
    const parsedIssueNumber = parseInt(issueNumber);
    if (issueNumber && parsedIssueNumber > 0) {
      const issueRepository = new IssueRepository();
      const isIssue = await issueRepository.isIssue(
        gitInfo.owner,
        gitInfo.repo,
        parsedIssueNumber,
        params[INPUT_KEYS.TOKEN] ?? ''
      );

      if (isIssue) {
        params.eventName = 'issue';
        params.issue = {
          number: parsedIssueNumber,
        }
        params.comment = {
          body: question,
        }
      }
    } else {
      // If no issue provided, set up as issue with question as body
      params.eventName = 'issue';
      params.issue = {
        number: 1,
      }
      params.comment = {
        body: question,
      }
    }

    params[INPUT_KEYS.WELCOME_TITLE] = '🤔 AI Reasoning Analysis';
    params[INPUT_KEYS.WELCOME_MESSAGES] = [
      `Starting deep code analysis for ${gitInfo.owner}/${gitInfo.repo}/${branch}...`,
      `Question: ${question.substring(0, 100)}${question.length > 100 ? '...' : ''}`,
    ];

    // logInfo(JSON.stringify(params, null, 2));
    runLocalAction(params);
  });

/**
 * Run the initial setup to configure labels, issue types, and verify access.
 */
program
  .command('setup')
  .description(`${TITLE} - Initial setup: create labels, issue types, and verify access`)
  .option('-d, --debug', 'Debug mode', false)
  .option('-t, --token <token>', 'Personal access token', process.env.PERSONAL_ACCESS_TOKEN)
  .action(async (options) => {    
    const gitInfo = getGitInfo();
    
    if ('error' in gitInfo) {
      console.log(gitInfo.error);
      return;
    }
    
    const params: any = {
      [INPUT_KEYS.DEBUG]: options.debug.toString(),
      [INPUT_KEYS.SINGLE_ACTION]: ACTIONS.INITIAL_SETUP,
      [INPUT_KEYS.SINGLE_ACTION_ISSUE]: 1,
      [INPUT_KEYS.SUPABASE_URL]: process.env.SUPABASE_URL,
      [INPUT_KEYS.SUPABASE_KEY]: process.env.SUPABASE_KEY,
      [INPUT_KEYS.TOKEN]: options.token || process.env.PERSONAL_ACCESS_TOKEN,
      repo: {
        owner: gitInfo.owner,
        repo: gitInfo.repo,
      },
      issue: {
        number: 1,
      },
    };

    params[INPUT_KEYS.WELCOME_TITLE] = '⚙️  Initial Setup';
    params[INPUT_KEYS.WELCOME_MESSAGES] = [
      `Running initial setup for ${gitInfo.owner}/${gitInfo.repo}...`,
      'This will create labels, issue types, and verify access to GitHub and Supabase.',
    ];

    await runLocalAction(params);
  });

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
          status: updates.status as 'pending' | 'in_progress' | 'completed' | 'cancelled' | undefined,
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
          status: updates.status as 'pending' | 'in_progress' | 'completed' | 'cancelled' | undefined,
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