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
        const typedUpdates: {
          status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
          notes?: string;
        } = {};
        if (updates.status) {
          typedUpdates.status = updates.status as 'pending' | 'in_progress' | 'completed' | 'cancelled';
        }
        if (updates.notes) {
          typedUpdates.notes = updates.notes;
        }
        return todoManager.updateTodo(id, typedUpdates);
      },
      getAllTodos: () => todoManager.getAllTodos(),
      getActiveTodos: () => todoManager.getActiveTodos()
    });

    const agent = new Agent({
      model: options.model,
      apiKey: options.apiKey,
      systemPrompt: `You are an advanced code analysis assistant. You have access to tools to:
- Read files from the repository
- Search for files by name or content
- Propose changes to files (changes are applied in a virtual codebase)
- Manage a TODO list to track tasks

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

program.parse(process.argv); 