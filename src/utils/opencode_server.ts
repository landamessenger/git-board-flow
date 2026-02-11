/**
 * Managed OpenCode server lifecycle for GitHub Actions.
 * Starts "npx opencode-ai serve" and stops it when the action finishes.
 * If no opencode.json exists in cwd, creates one with provider timeout 10 min and removes it on stop.
 */

import { spawn, ChildProcess } from 'child_process';
import { access, writeFile, unlink } from 'fs/promises';
import path from 'path';
import { logInfo, logError, logDebugInfo } from './logger';

const DEFAULT_PORT = 4096;
const HEALTH_PATH = '/global/health';
const POLL_INTERVAL_MS = 500;
const STARTUP_TIMEOUT_MS = 120000; // 2 min (first npx download can be slow)
const OPENCODE_CONFIG_FILENAME = 'opencode.json';
/** Provider request timeout in ms (10 min). OpenCode default is 5 min; we need longer for plan agent. */
const OPENCODE_PROVIDER_TIMEOUT_MS = 600_000;

export interface ManagedOpencodeServer {
  url: string;
  stop: () => Promise<void>;
}

/** Result of ensuring opencode config exists. If created, caller must remove it on teardown. */
interface OpencodeConfigResult {
  created: boolean;
  configPath: string;
}

/**
 * If opencode.json does not exist in cwd, create it with provider timeout (10 min).
 * OpenCode merges configs; this file will set provider.opencode.options.timeout so long requests don't get cut at 5 min.
 */
async function ensureOpencodeConfig(cwd: string): Promise<OpencodeConfigResult> {
  const configPath = path.join(cwd, OPENCODE_CONFIG_FILENAME);
  try {
    await access(configPath);
    return { created: false, configPath };
  } catch {
    // File does not exist; create minimal config for provider timeout
  }
  const config = {
    $schema: 'https://opencode.ai/config.json',
    provider: {
      opencode: {
        options: {
          timeout: OPENCODE_PROVIDER_TIMEOUT_MS,
        },
      },
    },
  };
  await writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');
  logInfo(`Created ${OPENCODE_CONFIG_FILENAME} with provider timeout ${OPENCODE_PROVIDER_TIMEOUT_MS / 60_000} min (will remove on server stop).`);
  return { created: true, configPath };
}

/**
 * Remove opencode.json if we created it (so we don't leave a temporary file in the repo).
 */
async function removeOpencodeConfigIfCreated(result: OpencodeConfigResult): Promise<void> {
  if (!result.created) return;
  try {
    await unlink(result.configPath);
    logInfo(`Removed temporary ${OPENCODE_CONFIG_FILENAME}.`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logError(`Failed to remove temporary ${OPENCODE_CONFIG_FILENAME}: ${msg}`);
  }
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

  const configResult = await ensureOpencodeConfig(cwd);

  logInfo(`Starting OpenCode server at ${baseUrl} (this may take a moment on first run)...`);

  const child = spawn(
    'npx',
    ['-y', 'opencode-ai', 'serve', '--port', String(port), '--hostname', hostname],
    {
      cwd,
      env: { ...process.env, OPENCODE_CLIENT: 'copilot' },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    }
  );

  const stop = async (): Promise<void> => {
    await stopOpencodeServer(child);
    await removeOpencodeConfigIfCreated(configResult);
  };

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
 * Destroys stdio pipes first so the child can exit without blocking on write.
 */
export async function stopOpencodeServer(child: ChildProcess): Promise<void> {
  if (!child.pid) return;
  logInfo('Stopping OpenCode server process...');
  const destroyIfPossible = (s: typeof child.stdout) => {
    if (s && typeof (s as { destroy?: () => void }).destroy === 'function') (s as { destroy: () => void }).destroy();
  };
  destroyIfPossible(child.stdout);
  destroyIfPossible(child.stderr);
  return new Promise((resolve) => {
    const onExit = () => {
      clearTimeout(t);
      logInfo('OpenCode server process exited.');
      resolve();
    };
    child.once('exit', onExit);
    child.kill('SIGTERM');
    const t = setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch {
        // ignore
      }
      logInfo('OpenCode server stop timeout reached (SIGKILL sent).');
      resolve();
    }, 5000);
  });
}
