/**
 * Runs verify commands and then git add/commit/push for bugbot autofix.
 * Uses @actions/exec; intended to run in the GitHub Action runner where the repo is checked out.
 * Configures git user.name and user.email from the token user so the commit has a valid author.
 */

import * as exec from "@actions/exec";
import { ProjectRepository } from "../../../../data/repository/project_repository";
import { logDebugInfo, logError, logInfo } from "../../../../utils/logger";
import type { Execution } from "../../../../data/model/execution";

export interface BugbotAutofixCommitResult {
    success: boolean;
    committed: boolean;
    error?: string;
}

/**
 * Optionally check out the branch (when event is issue_comment and we resolved the branch from an open PR).
 */
async function checkoutBranchIfNeeded(branch: string): Promise<boolean> {
    try {
        await exec.exec("git", ["fetch", "origin", branch]);
        await exec.exec("git", ["checkout", branch]);
        logInfo(`Checked out branch ${branch}.`);
        return true;
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logError(`Failed to checkout branch ${branch}: ${msg}`);
        return false;
    }
}

/**
 * Runs verify commands in order. Returns true if all pass.
 */
async function runVerifyCommands(commands: string[]): Promise<{ success: boolean; failedCommand?: string }> {
    for (const cmd of commands) {
        const parts = cmd.trim().split(/\s+/);
        const program = parts[0];
        const args = parts.slice(1);
        try {
            const code = await exec.exec(program, args);
            if (code !== 0) {
                return { success: false, failedCommand: cmd };
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            logError(`Verify command failed: ${cmd} - ${msg}`);
            return { success: false, failedCommand: cmd };
        }
    }
    return { success: true };
}

/**
 * Returns true if there are uncommitted changes (working tree or index).
 */
async function hasChanges(): Promise<boolean> {
    let output = "";
    await exec.exec("git", ["status", "--short"], {
        listeners: {
            stdout: (data: Buffer) => {
                output += data.toString();
            },
        },
    });
    return output.trim().length > 0;
}

/**
 * Runs verify commands (if configured), then git add, commit, and push.
 * When branchOverride is set, checks out that branch first (e.g. for issue_comment events).
 */
export async function runBugbotAutofixCommitAndPush(
    execution: Execution,
    options?: { branchOverride?: string }
): Promise<BugbotAutofixCommitResult> {
    const branchOverride = options?.branchOverride;
    const branch = branchOverride ?? execution.commit.branch;

    if (!branch?.trim()) {
        return { success: false, committed: false, error: "No branch to commit to." };
    }

    if (branchOverride) {
        const ok = await checkoutBranchIfNeeded(branch);
        if (!ok) {
            return { success: false, committed: false, error: `Failed to checkout branch ${branch}.` };
        }
    }

    const verifyCommands = execution.ai?.getBugbotFixVerifyCommands?.() ?? [];
    if (verifyCommands.length > 0) {
        logInfo(`Running ${verifyCommands.length} verify command(s)...`);
        const verify = await runVerifyCommands(verifyCommands);
        if (!verify.success) {
            return {
                success: false,
                committed: false,
                error: `Verify command failed: ${verify.failedCommand ?? "unknown"}.`,
            };
        }
    }

    const changed = await hasChanges();
    if (!changed) {
        logDebugInfo("No changes to commit after autofix.");
        return { success: true, committed: false };
    }

    try {
        const projectRepository = new ProjectRepository();
        const { name, email } = await projectRepository.getTokenUserDetails(execution.tokens.token);
        await exec.exec("git", ["config", "user.name", name]);
        await exec.exec("git", ["config", "user.email", email]);
        logDebugInfo(`Git author set to ${name} <${email}>.`);

        await exec.exec("git", ["add", "-A"]);
        const commitMessage = "fix: bugbot autofix - resolve reported findings";
        await exec.exec("git", ["commit", "-m", commitMessage]);
        await exec.exec("git", ["push", "origin", branch]);
        logInfo(`Pushed commit to origin/${branch}.`);
        return { success: true, committed: true };
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logError(`Commit or push failed: ${msg}`);
        return { success: false, committed: false, error: msg };
    }
}
