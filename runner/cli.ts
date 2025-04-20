#!/usr/bin/env node

import os from 'os';
import { execSync } from 'child_process';

const platform = os.platform();
const arch = os.arch();

let execTarget: string | null = null;

if (platform === 'darwin') {
  execTarget = arch === 'arm64'
    ? './build/cli/macos/arm64/index.js'
    : './build/cli/macos/x64/index.js';
} else if (platform === 'linux') {
  execTarget = arch === 'arm64'
    ? './build/cli/linux/arm64/index.js'
    : './build/cli/linux/x64/index.js';
}

if (!execTarget) {
  throw new Error(`Unsupported platform (${platform}) or architecture (${arch})`);
}

const args = process.argv.slice(2).join(' ');

execSync(`node ${execTarget} ${args}`, { stdio: 'inherit' });
