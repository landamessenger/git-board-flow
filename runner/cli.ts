#!/usr/bin/env node

/**
 * CLI Entry Point
 * 
 * This script serves as the main entry point for the CLI application.
 * It determines the appropriate binary to execute based on the current
 * platform (macOS/Linux) and architecture (x64/arm64).
 * 
 * The script:
 * 1. Detects the current platform and architecture
 * 2. Maps them to the corresponding pre-built binary path
 * 3. Executes the binary with the provided command line arguments
 */

import os from 'os';
import { execSync } from 'child_process';

// Get current platform and architecture
const platform = os.platform();
const arch = os.arch();

let execTarget: string | null = null;

// Map platform and architecture to the correct binary path
if (platform === 'darwin') {
  execTarget = arch === 'arm64'
    ? './build/cli/macos/arm64/index.js'
    : './build/cli/macos/x64/index.js';
} else if (platform === 'linux') {
  execTarget = arch === 'arm64'
    ? './build/cli/linux/arm64/index.js'
    : './build/cli/linux/x64/index.js';
}

// Validate that we have a supported platform/architecture combination
if (!execTarget) {
  throw new Error(`Unsupported platform (${platform}) or architecture (${arch})`);
}

// Pass through all command line arguments to the target binary
const args = process.argv.slice(2).join(' ');

// Execute the target binary with the provided arguments
execSync(`node ${execTarget} ${args}`, { stdio: 'inherit' });
