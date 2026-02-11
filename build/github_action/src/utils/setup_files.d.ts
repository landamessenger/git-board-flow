/**
 * Ensure .github, .github/workflows and .github/ISSUE_TEMPLATE exist; create them if missing.
 * @param cwd - Directory (repo root)
 */
export declare function ensureGitHubDirs(cwd: string): void;
/**
 * Copy setup files from setup/ to repo (.github/ workflows, ISSUE_TEMPLATE, pull_request_template.md, .env at root).
 * Skips files that already exist at destination (no overwrite).
 * Logs each file copied or skipped. No-op if setup/ does not exist.
 * @param cwd - Repo root
 * @returns { copied, skipped }
 */
export declare function copySetupFiles(cwd: string): {
    copied: number;
    skipped: number;
};
