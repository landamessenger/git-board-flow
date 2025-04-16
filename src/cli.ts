#!/usr/bin/env node

import { Command } from 'commander';
import { INPUT_KEYS } from './utils/constants';
import { runLocalAction } from './actions/local_action';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const program = new Command();

program
  .name('git-board-flow')
  .description('CLI tool for Git Board Flow')
  .version('1.0.0');

program
  .command('build-ai')
  .description('Build AI')
  .action(() => {
    console.log('Executing command A');
    
    const params = {
      [INPUT_KEYS.DEBUG]: 'true',
      [INPUT_KEYS.SINGLE_ACTION]: 'vector_action',
      [INPUT_KEYS.SINGLE_ACTION_ISSUE]: '1',
      [INPUT_KEYS.SUPABASE_URL]: process.env.SUPABASE_URL,
      [INPUT_KEYS.SUPABASE_KEY]: process.env.SUPABASE_KEY,
      [INPUT_KEYS.TOKEN]: process.env.PERSONAL_ACCESS_TOKEN,
      [INPUT_KEYS.AI_IGNORE_FILES]: 'dist/*,bin/*',
      repo: {
        owner: 'landamessenger',
        repo: 'git-board-flow',
      },
      commits: {
        ref: 'refs/heads/master',
      },
      issue: {
        number: 1,
      },
    }

    runLocalAction(params);
  });

program.parse(process.argv); 