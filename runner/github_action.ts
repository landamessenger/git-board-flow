/**
 * This script serves as a runner for GitHub Actions, executing the common
 * compiled binary with the necessary environment variables.
 * 
 * It sets up environment variables for the GitHub Action,
 * including passing through all INPUT_* variables from the parent process.
 */

import { execSync } from 'child_process';

/**
 * Execute the common GitHub Action binary with:
 * - Inherited stdio for proper output handling
 * - All environment variables from the parent process
 * - All INPUT_* variables passed as a JSON string in INPUT_VARS_JSON
 */
execSync(`node ./build/github_action/index.js`, {
  stdio: 'inherit',
  env: {
    ...process.env,
    INPUT_VARS_JSON: JSON.stringify(
      Object.fromEntries(
        Object.entries(process.env).filter(([key]) => key.startsWith('INPUT_'))
      )
    )
  }
});
