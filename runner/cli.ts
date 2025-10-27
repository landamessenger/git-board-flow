#!/usr/bin/env node

/**
 * CLI Entry Point
 * 
 * This script serves as the main entry point for the CLI application.
 * It executes the common compiled binary with the provided command line arguments.
 */

import { execSync } from 'child_process';

// Pass through all command line arguments to the target binary
const args = process.argv.slice(2).join(' ');

// Execute the common binary with the provided arguments
execSync(`node ./build/cli/index.js ${args}`, { stdio: 'inherit' });
