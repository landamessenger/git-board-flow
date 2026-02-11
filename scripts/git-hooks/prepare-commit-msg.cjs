/**
 * Ensures the commit message starts with the current branch name (with / replaced by -).
 * Strips any existing prefix so the correct one is always applied.
 * Cross-platform (Windows, macOS, Linux). Invoked by the prepare-commit-msg shell launcher.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const msgFile = process.argv[2];
const source = process.argv[3];

if (!msgFile || !fs.existsSync(msgFile) || !fs.statSync(msgFile).isFile()) {
  process.exit(0);
}

if (source === 'merge' || source === 'squash') {
  process.exit(0);
}

const root = path.resolve(__dirname, '..', '..');
const r = spawnSync('git', ['branch', '--show-current'], { cwd: root, encoding: 'utf8' });
const branch = (r.stdout && r.stdout.trim()) || '';
if (!branch) process.exit(0);

const prefix = branch.replace(/\//g, '-');

const content = fs.readFileSync(msgFile, 'utf8');
const lines = content.split(/\r?\n/);
const firstLine = lines[0] || '';
if (!firstLine.trim()) process.exit(0);

const match = firstLine.match(/^[^:]+:\s*(.+)$/);
const body = match ? match[1] : firstLine;
const rest = lines.slice(1).join('\n');

const newContent = rest ? `${prefix}: ${body}\n${rest}` : `${prefix}: ${body}\n`;
fs.writeFileSync(msgFile, newContent, 'utf8');
