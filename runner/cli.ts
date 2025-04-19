#!/usr/bin/env node

import os from 'os';
import { execSync } from 'child_process';

const execTarget = os.platform() === 'darwin'
  ? './bin/macos/index.js'
  : os.platform() === 'linux'
    ? './bin/linux/index.js'
    : null;

if (!execTarget) throw new Error('Unsupported OS');

// 👇 juntar los argumentos que recibió este proceso
const args = process.argv.slice(2).join(' ');

// 👇 pasar los args al comando que se ejecuta
execSync(`node ${execTarget} ${args}`, { stdio: 'inherit' });
