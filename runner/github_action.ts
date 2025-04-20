import os from 'os';
import { execSync } from 'child_process';

const platform = os.platform();
const arch = os.arch();

let execTarget: string | null = null;

if (platform === 'darwin') {
  execTarget = arch === 'arm64'
    ? './build/github_action/macos/arm64/index.js'
    : './build/github_action/macos/x64/index.js';
} else if (platform === 'linux') {
  execTarget = arch === 'arm64'
    ? './build/github_action/linux/arm64/index.js'
    : './build/github_action/linux/x64/index.js';
}

if (!execTarget) {
  throw new Error(`Unsupported platform (${platform}) or architecture (${arch})`);
}

// Log all INPUT_ environment variables
const inputVars = Object.entries(process.env).filter(([key]) => key.startsWith('INPUT_'));
console.log('Found INPUT_ environment variables:', JSON.stringify(inputVars, null, 2));

// Create a JSON object with all INPUT_ variables
const inputVarsJson = JSON.stringify(Object.fromEntries(inputVars));

execSync(`node ${execTarget}`, {
  stdio: 'inherit',
  env: {
    ...process.env,
    DUMMY_VAR: 'DUMMY_VALUE',
    INPUT_VARS_JSON: inputVarsJson
  }
});
