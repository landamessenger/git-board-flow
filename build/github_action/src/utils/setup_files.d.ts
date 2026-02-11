/**
 * Ensure .github and .github/workflows exist; create them if missing.
 * @param cwd - Directory (repo root)
 */
export declare function ensureGitHubDirs(cwd: string): void;
/**
 * Copy setup files from setup/ to repo (.github/ workflows, pull_request_template.md, .env at root).
 * Skips files that already exist at destination (no overwrite).
 * Logs each file copied or skipped. No-op if setup/ does not exist.
 * @param cwd - Repo root
 * @returns Number of files copied
 */
export declare function copySetupFiles(cwd: string): number;
