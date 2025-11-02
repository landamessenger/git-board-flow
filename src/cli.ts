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
  .name(COMMAND)
  .description(`CLI tool for ${TITLE}`)
  .version('1.0.0');
  program
  .command('compile-vector-server')
  .description('Compile vector server container')
  .option('-d, --debug', 'Debug mode', false)
  .option('-p, --platforms <platforms>', 'Platforms', 'linux/amd64,linux/arm64,linux/arm/v7,linux/ppc64le,linux/s390x')
  .option('-v, --version <version>', 'Version', 'latest')
  .option('-t, --token <token>', 'Personal access token', process.env.PERSONAL_ACCESS_TOKEN)
  .option('-c, --classic-token <classictoken>', 'Classic personal access token', process.env.CLASSIC_TOKEN)
  .action(async (options) => {    
    const gitInfo = getGitInfo();
    
    if ('error' in gitInfo) {
      console.log(gitInfo.error);
      return;
    }
    
    const params: any = {
      [INPUT_KEYS.DEBUG]: options.debug.toString(),
      [INPUT_KEYS.SINGLE_ACTION]: ACTIONS.COMPILE_VECTOR_SERVER,
      [INPUT_KEYS.SINGLE_ACTION_VERSION]: options.version,
      [INPUT_KEYS.SINGLE_ACTION_ISSUE]: 1,
      [INPUT_KEYS.SUPABASE_URL]: process.env.SUPABASE_URL,
      [INPUT_KEYS.SUPABASE_KEY]: process.env.SUPABASE_KEY,
      [INPUT_KEYS.TOKEN]: options.token || process.env.PERSONAL_ACCESS_TOKEN,
      [INPUT_KEYS.CLASSIC_TOKEN]: options.classictoken || process.env.CLASSIC_TOKEN,
      [INPUT_KEYS.AI_IGNORE_FILES]: 'build/*',
      repo: {
        owner: gitInfo.owner,
        repo: gitInfo.repo,
      },
      issue: {
        number: 1,
      },
    };

    params[INPUT_KEYS.WELCOME_TITLE] = '👷🛠️ Vector Server Container Build';
    params[INPUT_KEYS.WELCOME_MESSAGES] = [
      `Building vector server container for ${gitInfo.owner}/${gitInfo.repo}...`,
    ];

    await runLocalAction(params);
  });

program
  .command('build-ai')
  .description('Build AI container and execute vector indexing')
  .option('-d, --debug', 'Debug mode', false)
  .option('-t, --token <token>', 'Personal access token', process.env.PERSONAL_ACCESS_TOKEN)
  .option('-c, --classic-token <classictoken>', 'Classic personal access token', process.env.CLASSIC_TOKEN)
  .action(async (options) => {    
    const gitInfo = getGitInfo();
    
    if ('error' in gitInfo) {
      console.log(gitInfo.error);
      return;
    }
    
    const params: any = {
      [INPUT_KEYS.DEBUG]: options.debug.toString(),
      [INPUT_KEYS.SINGLE_ACTION]: ACTIONS.VECTOR_LOCAL,
      [INPUT_KEYS.SINGLE_ACTION_ISSUE]: 1,
      [INPUT_KEYS.SUPABASE_URL]: process.env.SUPABASE_URL,
      [INPUT_KEYS.SUPABASE_KEY]: process.env.SUPABASE_KEY,
      [INPUT_KEYS.TOKEN]: options.token || process.env.PERSONAL_ACCESS_TOKEN,
      [INPUT_KEYS.CLASSIC_TOKEN]: options.classictoken || process.env.CLASSIC_TOKEN,
      [INPUT_KEYS.AI_IGNORE_FILES]: 'build/*',
      repo: {
        owner: gitInfo.owner,
        repo: gitInfo.repo,
      },
      issue: {
        number: 1,
      },
    };

    params[INPUT_KEYS.WELCOME_TITLE] = '🚀 AI Container Build';
    params[INPUT_KEYS.WELCOME_MESSAGES] = [
      `Building AI container for ${gitInfo.owner}/${gitInfo.repo}...`,
    ];

    await runLocalAction(params);
  });

/**
 * Run the asking AI scenario on issues or pull requests.
 * 
 * For the action of asking the AI to be executed, the bot user managing the repository must be mentioned.
 */
program
  .command('ask-ai')
  .description('Ask AI')
  .option('-i, --issue <number>', 'Issue number to process', '1')
  .option('-b, --branch <name>', 'Branch name', 'master')
  .option('-d, --debug', 'Debug mode', false)
  .option('-t, --token <token>', 'Personal access token', process.env.PERSONAL_ACCESS_TOKEN)
  .option('-q, --question <question...>', 'Question', '')
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

    const commentBody = (options.question || []).join(' ');

    const params: any = {
      [INPUT_KEYS.DEBUG]: options.debug.toString(),
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
        ref: `refs/heads/${options.branch}`,
      },
    }

    const issueRepository = new IssueRepository();
    const isIssue = await issueRepository.isIssue(
      gitInfo.owner,
      gitInfo.repo,
      parseInt(options.issue),
      params[INPUT_KEYS.TOKEN] ?? ''
    );

    const isPullRequest = await issueRepository.isPullRequest(
      gitInfo.owner,
      gitInfo.repo,
      parseInt(options.issue),
      params[INPUT_KEYS.TOKEN] ?? ''
    );

    if (isIssue) {
      params.eventName = 'issue_comment';
      params.issue = {
        number: parseInt(options.issue),
      }
      params.comment = {
        body: commentBody,
      }
    } else if (isPullRequest) {
      params.eventName = 'pull_request_review_comment';
      params.pull_request = {
        number: parseInt(options.issue),
      }
      params.pull_request_review_comment = {
        body: commentBody,
      }
    }

    params[INPUT_KEYS.WELCOME_TITLE] = '🚀 Asking AI started';
    params[INPUT_KEYS.WELCOME_MESSAGES] = [
      `Asking AI on ${gitInfo.owner}/${gitInfo.repo}/${options.branch}...`,
    ];

    logInfo(JSON.stringify(params, null, 2));
    runLocalAction(params);
  });

program.parse(process.argv); 