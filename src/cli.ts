#!/usr/bin/env node

import { Command } from 'commander';
import { INPUT_KEYS, ERRORS, ACTIONS, TITLE, COMMAND } from './utils/constants';
import { runLocalAction } from './actions/local_action';
import * as dotenv from 'dotenv';
import { execSync } from 'child_process';
import boxen from 'boxen';
import chalk from 'chalk';
import { logInfo } from './utils/logger';
import { IssueRepository } from './data/repository/issue_repository';

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
  .command('build-ai')
  .description('Build AI')
  .option('-i, --issue <number>', 'Issue number to process', '1')
  .option('-b, --branch <name>', 'Branch name', 'master')
  .option('-d, --debug', 'Debug mode', false)
  .option('-t, --token <token>', 'Personal access token', process.env.PERSONAL_ACCESS_TOKEN)
  .action((options) => {    
    const gitInfo = getGitInfo();
    
    if ('error' in gitInfo) {
      console.log(gitInfo.error);
      return;
    }

    const params = {
      [INPUT_KEYS.DEBUG]: options.debug.toString(),
      [INPUT_KEYS.SINGLE_ACTION]: ACTIONS.VECTOR,
      [INPUT_KEYS.SINGLE_ACTION_ISSUE]: options.issue,
      [INPUT_KEYS.SUPABASE_URL]: process.env.SUPABASE_URL,
      [INPUT_KEYS.SUPABASE_KEY]: process.env.SUPABASE_KEY,
      [INPUT_KEYS.TOKEN]: process.env.PERSONAL_ACCESS_TOKEN,
      [INPUT_KEYS.AI_IGNORE_FILES]: 'dist/*,bin/*',
      repo: {
        owner: gitInfo.owner,
        repo: gitInfo.repo,
      },
      commits: {
        ref: `refs/heads/${options.branch}`,
      },
      issue: {
        number: parseInt(options.issue),
      },
    }

    logInfo(
      boxen(
        chalk.cyan('🚀 Vectorization started\n') +
        chalk.gray(`Processing code blocks on ${gitInfo.owner}/${gitInfo.repo}/${options.branch}...`),
        {
          padding: 1,
          margin: 1,
          borderStyle: 'round',
          borderColor: 'cyan',
          title: TITLE,
          titleAlignment: 'center'
        }
      )
    );

    runLocalAction(params);
  });

  program
  .command('ask-ai')
  .description('Ask AI')
  .option('-i, --issue <number>', 'Issue number to process', '1')
  .option('-b, --branch <name>', 'Branch name', 'master')
  .option('-d, --debug', 'Debug mode', false)
  .option('-t, --token <token>', 'Personal access token', process.env.PERSONAL_ACCESS_TOKEN)
  .option('-m, --model <model>', 'OpenRouter model', process.env.OPENROUTER_MODEL)
  .option('-k, --key <key>', 'OpenRouter API key', process.env.OPENROUTER_API_KEY)
  .option('-p, --provider <provider>', 'OpenRouter provider', process.env.OPENROUTER_PROVIDER_ORDER)
  .option('-f, --fallback <fallback>', 'OpenRouter fallback', process.env.OPENROUTER_PROVIDER_ALLOW_FALLBACKS)
  .option('-r, --require <require>', 'OpenRouter require', process.env.OPENROUTER_PROVIDER_REQUIRE_PARAMETERS)
  .option('-c, --collection <collection>', 'OpenRouter collection', process.env.OPENROUTER_PROVIDER_DATA_COLLECTION)
  .option('-q, --question <question>', 'Question', '')
  .action(async (options) => {    
    const gitInfo = getGitInfo();
    
    if ('error' in gitInfo) {
      console.log(gitInfo.error);
      return;
    }

    const commentBody = options.question;

    const params: any = {
      [INPUT_KEYS.DEBUG]: options.debug.toString(),
      [INPUT_KEYS.SINGLE_ACTION]: ACTIONS.ASK,
      [INPUT_KEYS.SINGLE_ACTION_ISSUE]: options.issue,
      [INPUT_KEYS.SUPABASE_URL]: process.env.SUPABASE_URL,
      [INPUT_KEYS.SUPABASE_KEY]: process.env.SUPABASE_KEY,
      [INPUT_KEYS.TOKEN]: process.env.PERSONAL_ACCESS_TOKEN,
      [INPUT_KEYS.OPENROUTER_API_KEY]: process.env.OPENROUTER_API_KEY,
      [INPUT_KEYS.OPENROUTER_MODEL]: process.env.OPENROUTER_MODEL,
      [INPUT_KEYS.OPENROUTER_PROVIDER_ORDER]: process.env.OPENROUTER_PROVIDER_ORDER,
      [INPUT_KEYS.OPENROUTER_PROVIDER_ALLOW_FALLBACKS]: process.env.OPENROUTER_PROVIDER_ALLOW_FALLBACKS,
      [INPUT_KEYS.OPENROUTER_PROVIDER_REQUIRE_PARAMETERS]: process.env.OPENROUTER_PROVIDER_REQUIRE_PARAMETERS,
      [INPUT_KEYS.OPENROUTER_PROVIDER_DATA_COLLECTION]: process.env.OPENROUTER_PROVIDER_DATA_COLLECTION,
      [INPUT_KEYS.AI_IGNORE_FILES]: 'dist/*,bin/*',
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
      process.env.PERSONAL_ACCESS_TOKEN ?? ''
    );

    const isPullRequest = await issueRepository.isPullRequest(
      gitInfo.owner,
      gitInfo.repo,
      parseInt(options.issue),
      process.env.PERSONAL_ACCESS_TOKEN ?? ''
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
      params.issue = {
        number: parseInt(options.issue),
      }
      params.pull_request_review_comment = {
        body: commentBody,
      }
    }

    logInfo(
      boxen(
        chalk.cyan('🚀 Asking AI started\n') +
        chalk.gray(`Asking AI on ${gitInfo.owner}/${gitInfo.repo}/${options.branch}...`),
        {
          padding: 1,
          margin: 1,
          borderStyle: 'round',
          borderColor: 'cyan',
          title: TITLE,
          titleAlignment: 'center'
        }
      )
    );

    runLocalAction(params);
  });

program.parse(process.argv); 