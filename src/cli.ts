#!/usr/bin/env node

import { Command } from 'commander';
import { INPUT_KEYS, ERRORS } from './utils/constants';
import { runLocalAction } from './actions/local_action';
import * as dotenv from 'dotenv';
import { execSync } from 'child_process';
import boxen from 'boxen';
import chalk from 'chalk';
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
  .name('git-board-flow')
  .description('CLI tool for Git Board Flow')
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
      [INPUT_KEYS.SINGLE_ACTION]: 'vector_action',
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
          title: 'Git Board Flow',
          titleAlignment: 'center'
        }
      )
    );

    runLocalAction(params);
  });

program.parse(process.argv); 