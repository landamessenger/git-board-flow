/**
 * Unit tests for runBugbotAutofixCommitAndPush: no branch, branchOverride checkout, verify commands, no changes, commit/push, git author.
 */

import * as exec from "@actions/exec";
import { runBugbotAutofixCommitAndPush } from "../bugbot_autofix_commit";
import type { Execution } from "../../../../../data/model/execution";

jest.mock("../../../../../utils/logger", () => ({
    logInfo: jest.fn(),
    logDebugInfo: jest.fn(),
    logError: jest.fn(),
}));

const mockGetTokenUserDetails = jest.fn();
jest.mock("../../../../../data/repository/project_repository", () => ({
    ProjectRepository: jest.fn().mockImplementation(() => ({
        getTokenUserDetails: mockGetTokenUserDetails,
    })),
}));

const mockExec = jest.spyOn(exec, "exec") as jest.Mock;

type ExecCallback = (
    cmd: string,
    args?: string[],
    opts?: { listeners?: { stdout?: (d: Buffer) => void } }
) => Promise<number>;

function baseExecution(overrides: Partial<Execution> = {}): Execution {
    return {
        owner: "o",
        repo: "r",
        issueNumber: 42,
        tokens: { token: "t" },
        commit: { branch: "feature/42-foo" },
        ai: {
            getBugbotFixVerifyCommands: () => [] as string[],
        },
        ...overrides,
    } as unknown as Execution;
}

describe("runBugbotAutofixCommitAndPush", () => {
    beforeEach(() => {
        mockExec.mockReset();
        mockGetTokenUserDetails.mockResolvedValue({
            name: "Test User",
            email: "test@users.noreply.github.com",
        });
    });

    it("returns success false and committed false when branch is empty", async () => {
        const result = await runBugbotAutofixCommitAndPush(
            baseExecution({ commit: { branch: "" } } as Partial<Execution>)
        );

        expect(result).toEqual({ success: false, committed: false, error: "No branch to commit to." });
        expect(mockExec).not.toHaveBeenCalled();
    });

    it("calls git fetch and checkout when branchOverride is set", async () => {
        (mockExec.mockImplementation as (fn: ExecCallback) => void)((_cmd, args, opts) => {
            const a = args ?? [];
            if (a[0] === "status" && opts?.listeners?.stdout) {
                opts.listeners.stdout(Buffer.from(""));
            }
            return Promise.resolve(0);
        });

        const result = await runBugbotAutofixCommitAndPush(baseExecution(), {
            branchOverride: "feature/42-from-pr",
        });

        expect(mockExec).toHaveBeenCalledWith("git", ["fetch", "origin", "feature/42-from-pr"]);
        expect(mockExec).toHaveBeenCalledWith("git", ["checkout", "feature/42-from-pr"]);
        expect(mockExec).toHaveBeenCalledWith("git", ["status", "--short"], expect.any(Object));
        expect(result.success).toBe(true);
        expect(result.committed).toBe(false);
    });

    it("returns failure when checkout fails", async () => {
        mockExec.mockRejectedValueOnce(new Error("fetch failed"));

        const result = await runBugbotAutofixCommitAndPush(baseExecution(), {
            branchOverride: "feature/42-pr",
        });

        expect(result).toEqual({
            success: false,
            committed: false,
            error: "Failed to checkout branch feature/42-pr.",
        });
    });

    it("runs verify commands when configured and returns failure when one fails", async () => {
        const exec = baseExecution({
            ai: { getBugbotFixVerifyCommands: () => ["npm test"] },
        } as Partial<Execution>);
        mockExec.mockResolvedValueOnce(1);

        const result = await runBugbotAutofixCommitAndPush(exec);

        expect(mockExec).toHaveBeenCalledWith("npm", ["test"]);
        expect(result).toEqual({
            success: false,
            committed: false,
            error: "Verify command failed: npm test.",
        });
    });

    it("rejects verify command with shell operator (command injection)", async () => {
        const exec = baseExecution({
            ai: { getBugbotFixVerifyCommands: () => ["npm test; rm -rf /"] },
        } as Partial<Execution>);

        const result = await runBugbotAutofixCommitAndPush(exec);

        expect(result.success).toBe(false);
        expect(result.error).toContain("Invalid verify command");
        expect(mockExec).not.toHaveBeenCalledWith("npm", expect.any(Array));
    });

    it("parses verify command with quoted args and runs it", async () => {
        const exec = baseExecution({
            ai: { getBugbotFixVerifyCommands: () => ['npm run "test with spaces"'] },
        } as Partial<Execution>);
        (mockExec.mockImplementation as (fn: ExecCallback) => void)((_cmd, args, opts) => {
            const a = args ?? [];
            if (a[0] === "status" && opts?.listeners?.stdout) {
                opts.listeners.stdout(Buffer.from(""));
            }
            return Promise.resolve(0);
        });

        const result = await runBugbotAutofixCommitAndPush(exec);

        expect(result.success).toBe(true);
        expect(result.committed).toBe(false);
        expect(mockExec).toHaveBeenCalledWith("npm", ["run", "test with spaces"]);
    });

    it("returns success and committed false when hasChanges returns false", async () => {
        (mockExec.mockImplementation as (fn: ExecCallback) => void)((_cmd, args, opts) => {
            const a = args ?? [];
            if (a[0] === "status" && opts?.listeners?.stdout) {
                opts.listeners.stdout(Buffer.from(""));
            }
            return Promise.resolve(0);
        });

        const result = await runBugbotAutofixCommitAndPush(baseExecution());

        expect(result.success).toBe(true);
        expect(result.committed).toBe(false);
    });

    it("runs git config (user.name, user.email), add, commit, push when there are changes", async () => {
        (mockExec.mockImplementation as (fn: ExecCallback) => void)((_cmd, args, opts) => {
            const a = args ?? [];
            if (a[0] === "status" && opts?.listeners?.stdout) {
                opts.listeners.stdout(Buffer.from(" M file.ts"));
            }
            return Promise.resolve(0);
        });

        const result = await runBugbotAutofixCommitAndPush(baseExecution());

        expect(result.success).toBe(true);
        expect(result.committed).toBe(true);
        expect(mockGetTokenUserDetails).toHaveBeenCalledWith("t");
        expect(mockExec).toHaveBeenCalledWith("git", ["config", "user.name", "Test User"]);
        expect(mockExec).toHaveBeenCalledWith("git", ["config", "user.email", "test@users.noreply.github.com"]);
        expect(mockExec).toHaveBeenCalledWith("git", ["add", "-A"]);
        expect(mockExec).toHaveBeenCalledWith("git", [
            "commit",
            "-m",
            "fix: bugbot autofix - resolve reported findings",
        ]);
        expect(mockExec).toHaveBeenCalledWith("git", ["push", "origin", "feature/42-foo"]);
    });

    it("returns failure when commit or push throws", async () => {
        (mockExec.mockImplementation as (fn: ExecCallback) => void)((_cmd, args, opts) => {
            const a = args ?? [];
            if (a[0] === "status" && opts?.listeners?.stdout) {
                opts.listeners.stdout(Buffer.from(" M x"));
            }
            if (a[0] === "commit") return Promise.reject(new Error("commit failed"));
            return Promise.resolve(0);
        });
        mockGetTokenUserDetails.mockResolvedValue({ name: "U", email: "u@x.com" });

        const result = await runBugbotAutofixCommitAndPush(baseExecution());

        expect(result).toEqual({
            success: false,
            committed: false,
            error: "commit failed",
        });
    });
});
