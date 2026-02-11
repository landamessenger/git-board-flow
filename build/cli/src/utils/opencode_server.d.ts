/**
 * Managed OpenCode server lifecycle for GitHub Actions.
 * Starts "npx opencode-ai serve" and stops it when the action finishes.
 * If no opencode.json exists in cwd, creates one with provider timeout 10 min and removes it on stop.
 */
import { ChildProcess } from 'child_process';
export interface ManagedOpencodeServer {
    url: string;
    stop: () => Promise<void>;
}
/**
 * Start OpenCode server in the background and wait until it is healthy.
 * Uses npx so the binary is fetched on first use (no pre-install needed).
 * Call the returned stop() when the action finishes (e.g. in finally).
 */
export declare function startOpencodeServer(options?: {
    port?: number;
    hostname?: string;
    cwd?: string;
}): Promise<ManagedOpencodeServer>;
/**
 * Stop the OpenCode server process cleanly.
 * Destroys stdio pipes first so the child can exit without blocking on write.
 */
export declare function stopOpencodeServer(child: ChildProcess): Promise<void>;
