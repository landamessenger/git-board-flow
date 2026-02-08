/**
 * Managed OpenCode server lifecycle for GitHub Actions.
 * Starts "npx opencode-ai serve" and stops it when the action finishes.
 */

import { spawn, ChildProcess } from 'child_process';
import { logInfo, logError, logDebugInfo } from './logger';

const DEFAULT_PORT = 4096;
const HEALTH_PATH = '/global/health';
const POLL_INTERVAL_MS = 500;
const STARTUP_TIMEOUT_MS = 120000; // 2 min (first npx download can be slow)

export interface ManagedOpencodeServer {
  url: string;
  stop: () => Promise<void>;
}

/**
 * Wait until OpenCode server responds to /global/health or timeout.
 */
async function waitForHealthy(baseUrl: string): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < STARTUP_TIMEOUT_MS) {
    try {
      const res = await fetch(`${baseUrl}${HEALTH_PATH}`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const data = (await res.json()) as { healthy?: boolean };
        if (data?.healthy === true) {
          return true;
        }
      }
    } catch {
      // ignore and retry
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  return false;
}

/**
 * Start OpenCode server in the background and wait until it is healthy.
 * Uses npx so the binary is fetched on first use (no pre-install needed).
 * Call the returned stop() when the action finishes (e.g. in finally).
 */
export async function startOpencodeServer(options?: {
  port?: number;
  hostname?: string;
  cwd?: string;
}): Promise<ManagedOpencodeServer> {
  const port = options?.port ?? DEFAULT_PORT;
  const hostname = options?.hostname ?? '127.0.0.1';
  const cwd = options?.cwd ?? process.cwd();
  const baseUrl = `http://${hostname}:${port}`;

  logInfo(`Starting OpenCode server at ${baseUrl} (this may take a moment on first run)...`);

  const child = spawn(
    'npx',
    ['-y', 'opencode-ai', 'serve', '--port', String(port), '--hostname', hostname],
    {
      cwd,
      env: { ...process.env, OPENCODE_CLIENT: 'git-board-flow' },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    }
  );

  const stop = (): Promise<void> => stopOpencodeServer(child);

  // Ensure we don't leave the process running if our process exits
  const onExit = () => {
    child.kill('SIGTERM');
  };
  process.once('exit', onExit);
  process.once('SIGINT', onExit);
  process.once('SIGTERM', onExit);

  // Log stderr so user sees OpenCode output if something goes wrong
  child.stderr?.on('data', (chunk: Buffer) => logDebugInfo(`[opencode] ${chunk.toString().trim()}`));

  child.on('error', (err) => {
    logError(`OpenCode server process error: ${err.message}`);
  });

  child.on('exit', (code, signal) => {
    if (code != null && code !== 0 && code !== 143) {
      logError(`OpenCode server exited with code ${code} signal ${signal}`);
    }
  });

  const healthy = await waitForHealthy(baseUrl);
  if (!healthy) {
    await stop();
    throw new Error(
      `OpenCode server did not become healthy within ${STARTUP_TIMEOUT_MS / 1000}s. Check that npx can run and that opencode-ai can be installed.`
    );
  }

  logInfo(`OpenCode server is ready at ${baseUrl}`);
  return { url: baseUrl, stop };
}

/**
 * Stop the OpenCode server process cleanly.
 */
export async function stopOpencodeServer(child: ChildProcess): Promise<void> {
  if (!child.pid) return;
  return new Promise((resolve) => {
    child.once('exit', () => resolve());
    child.kill('SIGTERM');
    const t = setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch {
        // ignore
      }
      resolve();
    }, 5000);
    child.once('exit', () => clearTimeout(t));
  });
}
