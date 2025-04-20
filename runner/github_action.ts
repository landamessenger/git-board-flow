/**
 * This script serves as a runner for GitHub Actions, determining the appropriate
 * executable path based on the platform and architecture, and executing it with
 * the necessary environment variables.
 * 
 * It handles different combinations of:
 * - Platforms: macOS (darwin) and Linux
 * - Architectures: arm64 and x64
 * 
 * The script also sets up environment variables for the GitHub Action,
 * including passing through all INPUT_* variables from the parent process.
 */

import os from 'os';
import { execSync } from 'child_process';

// Get current platform and architecture
const platform = os.platform();
const arch = os.arch();

/**
 * Path to the executable that will be run based on platform and architecture
 */
let execTarget: string | null = null;

// Determine the correct executable path based on platform and architecture
if (platform === 'darwin') {
  execTarget = arch === 'arm64'
    ? './build/github_action/macos/arm64/index.js'
    : './build/github_action/macos/x64/index.js';
} else if (platform === 'linux') {
  execTarget = arch === 'arm64'
    ? './build/github_action/linux/arm64/index.js'
    : './build/github_action/linux/x64/index.js';
}

// Validate that we have a valid executable path
if (!execTarget) {
  throw new Error(`Unsupported platform (${platform}) or architecture (${arch})`);
}

/**
 * Execute the target script with:
 * - Inherited stdio for proper output handling
 * - All environment variables from the parent process
 * - A dummy variable for testing purposes
 * - All INPUT_* variables passed as a JSON string in INPUT_VARS_JSON
 */
execSync(`node ${execTarget}`, {
  stdio: 'inherit',
  env: {
    ...process.env,
    DUMMY_VAR: 'DUMMY_VALUE',
    INPUT_VARS_JSON: JSON.stringify(
      Object.fromEntries(
        Object.entries(process.env).filter(([key]) => key.startsWith('INPUT_'))
      )
    )
  }
});
