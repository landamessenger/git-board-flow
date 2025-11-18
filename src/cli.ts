#!/usr/bin/env node

import { execSync } from 'child_process';
import { Command } from 'commander';
import * as dotenv from 'dotenv';
import { runLocalAction } from './actions/local_action';
import { IssueRepository } from './data/repository/issue_repository';
import { ACTIONS, COMMAND, ERRORS, INPUT_KEYS, TITLE } from './utils/constants';
import { logInfo } from './utils/logger';
import { registerAgentTestCommands } from './agent_tester_commands';
import { registerMCPTestCommands } from './mcp_tester_commands';
import { registerSubAgentTestCommands } from './sub_agent_tester_commands';
import { registerTECTestCommands } from './tec_tester_commands';
import { Copilot, CopilotOptions } from './agent/reasoning/copilot';

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
  .option('-b, --branch <name>', 'Branch name')
  .action(async (options) => {    
    const gitInfo = getGitInfo();
    
    if ('error' in gitInfo) {
      console.log(gitInfo.error);
      return;
    }
    const branch = options.branch;
  
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

    if (branch && branch.length > 0) {
      params.commits = {
        ref: `refs/heads/${branch}`,
      };
    }

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
 * Copilot agent - Advanced reasoning and code-manipulation capabilities.
 * Can analyze, explain, answer questions about, and modify source code.
 */
program
  .command('copilot')
  .description(`${TITLE} - AI development assistant for code analysis and manipulation`)
  .option('-p, --prompt <prompt...>', 'Prompt or question for the copilot agent (required)', '')
  .option('-b, --branch <name>', 'Branch name', 'master')
  .option('-d, --debug', 'Debug mode', false)
  .option('-t, --token <token>', 'Personal access token', process.env.PERSONAL_ACCESS_TOKEN)
  .option('--openrouter-api-key <key>', 'OpenRouter API key', process.env.OPENROUTER_API_KEY)
  .option('--openrouter-model <model>', 'OpenRouter model', process.env.OPENROUTER_MODEL)
  .option('--max-turns <number>', 'Maximum turns', '50')
  .option('--working-dir <dir>', 'Working directory for file operations (default: current directory)')
  .option('--use-subagents', 'Use subagents for parallel processing (recommended for large codebases)', false)
  .option('--max-concurrent-subagents <number>', 'Maximum concurrent subagents', '5')
  .option('--output <format>', 'Output format (text|json)', 'text')
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

    const promptParts = (options.prompt || []).map(cleanArg);
    const prompt = promptParts.join(' ');

    if (!prompt || prompt.length === 0) {
      console.log('❌ Please provide a prompt using -p or --prompt');
      return;
    }

    const branch = cleanArg(options.branch);
    const apiKey = cleanArg(options.openrouterApiKey);
    const model = cleanArg(options.openrouterModel);
    const token = cleanArg(options.token);
    const maxTurns = parseInt(cleanArg(options.maxTurns)) || 50;
    const workingDir = cleanArg(options.workingDir) || process.cwd();
    const useSubAgents = options.useSubagents === true;
    const maxConcurrentSubAgents = parseInt(cleanArg(options.maxConcurrentSubagents)) || 5;
    const outputFormat = cleanArg(options.output) || 'text';

    if (!apiKey) {
      console.log('❌ OpenRouter API key required. Set OPENROUTER_API_KEY or use --openrouter-api-key');
      return;
    }

    try {
      const copilotOptions: CopilotOptions = {
        model: model || process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
        apiKey: apiKey,
        personalAccessToken: token,
        maxTurns: maxTurns,
        repositoryOwner: gitInfo.owner,
        repositoryName: gitInfo.repo,
        repositoryBranch: branch,
        workingDirectory: workingDir,
        useSubAgents: useSubAgents,
        maxConcurrentSubAgents: maxConcurrentSubAgents
      };

      const copilot = new Copilot(copilotOptions);
      const result = await copilot.processPrompt(prompt);

      if (outputFormat === 'json') {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      // Text output (default)
      console.log('\n' + '='.repeat(80));
      console.log('🤖 COPILOT RESPONSE');
      console.log('='.repeat(80));
      console.log(`\n${result.response}\n`);

      if (result.changes && result.changes.length > 0) {
        console.log('='.repeat(80));
        console.log('📝 CHANGES MADE');
        console.log('='.repeat(80));
        result.changes.forEach((change, index) => {
          console.log(`\n${index + 1}. ${change.file}`);
          console.log(`   Type: ${change.changeType}`);
          if (change.description) {
            console.log(`   Description: ${change.description}`);
          }
        });
        console.log('');
      }

      if (result.agentResult.metrics) {
        console.log('='.repeat(80));
        console.log('📊 METRICS');
        console.log('='.repeat(80));
        console.log(`   - Total Turns: ${result.agentResult.turns.length}`);
        console.log(`   - Tool Calls: ${result.agentResult.toolCalls.length}`);
        console.log(`   - Input Tokens: ${result.agentResult.metrics.totalTokens.input}`);
        console.log(`   - Output Tokens: ${result.agentResult.metrics.totalTokens.output}`);
        console.log(`   - Total Duration: ${result.agentResult.metrics.totalDuration}ms`);
        console.log(`   - Average Latency: ${result.agentResult.metrics.averageLatency}ms`);
        console.log('');
      }
    } catch (error: any) {
      console.error('❌ Error executing copilot:', error.message || error);
      if (options.debug) {
        console.error(error);
      }
      process.exit(1);
    }
  });

/**
 * Check progress of an issue based on code changes.
 */
program
  .command('check-progress')
  .description(`${TITLE} - Check progress of an issue based on code changes`)
  .option('-i, --issue <number>', 'Issue number to check progress for (required)', '')
  .option('-b, --branch <name>', 'Branch name (optional, will try to determine from issue)')
  .option('-d, --debug', 'Debug mode', false)
  .option('-t, --token <token>', 'Personal access token', process.env.PERSONAL_ACCESS_TOKEN)
  .option('--openrouter-api-key <key>', 'OpenRouter API key', process.env.OPENROUTER_API_KEY)
  .option('--openrouter-model <model>', 'OpenRouter model', process.env.OPENROUTER_MODEL)
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

    const issueNumber = cleanArg(options.issue);

    if (!issueNumber || issueNumber.length === 0) {
      console.log('❌ Please provide an issue number using -i or --issue');
      return;
    }

    const parsedIssueNumber = parseInt(issueNumber);
    if (isNaN(parsedIssueNumber) || parsedIssueNumber <= 0) {
      console.log(`❌ Invalid issue number: ${issueNumber}. Must be a positive number.`);
      return;
    }

    const branch = cleanArg(options.branch);

    const params: any = {
      [INPUT_KEYS.DEBUG]: options.debug.toString(),
      [INPUT_KEYS.SINGLE_ACTION]: ACTIONS.CHECK_PROGRESS,
      [INPUT_KEYS.SINGLE_ACTION_ISSUE]: parsedIssueNumber,
      [INPUT_KEYS.SUPABASE_URL]: process.env.SUPABASE_URL,
      [INPUT_KEYS.SUPABASE_KEY]: process.env.SUPABASE_KEY,
      [INPUT_KEYS.TOKEN]: options.token || process.env.PERSONAL_ACCESS_TOKEN,
      [INPUT_KEYS.OPENROUTER_API_KEY]: options.openrouterApiKey || process.env.OPENROUTER_API_KEY,
      [INPUT_KEYS.OPENROUTER_MODEL]: options.openrouterModel || process.env.OPENROUTER_MODEL,
      [INPUT_KEYS.AI_IGNORE_FILES]: process.env.AI_IGNORE_FILES || 'build/*,dist/*,node_modules/*,*.d.ts',
      repo: {
        owner: gitInfo.owner,
        repo: gitInfo.repo,
      },
      issue: {
        number: parsedIssueNumber,
      },
    };

    // Set branch if provided
    if (branch && branch.length > 0) {
      params.commits = {
        ref: `refs/heads/${branch}`,
      };
    }

    params[INPUT_KEYS.WELCOME_TITLE] = '📊 Progress Check';
    params[INPUT_KEYS.WELCOME_MESSAGES] = [
      `Checking progress for issue #${parsedIssueNumber} in ${gitInfo.owner}/${gitInfo.repo}...`,
    ];

    await runLocalAction(params);
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

// Register agent test commands
registerAgentTestCommands(program);
registerMCPTestCommands(program);
registerSubAgentTestCommands(program);
registerTECTestCommands(program);

program.parse(process.argv); 