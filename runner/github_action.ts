import os from 'os';
import { execSync } from 'child_process';

const execTarget = os.platform() === 'darwin'
  ? './dist/macos/index.js'
  : os.platform() === 'linux'
    ? './dist/linux/index.js'
    : null;

if (!execTarget) throw new Error('Unsupported OS');
execSync(`node ${execTarget}`, { stdio: 'inherit', env: process.env });
