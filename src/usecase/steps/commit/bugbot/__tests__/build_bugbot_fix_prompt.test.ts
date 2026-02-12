/**
 * Unit tests for buildBugbotFixPrompt.
 */

import type { Execution } from "../../../../../data/model/execution";
import type { BugbotContext } from "../types";
import { buildBugbotFixPrompt } from "../build_bugbot_fix_prompt";

function mockExecution(overrides: Partial<Execution> = {}): Execution {
    return {
        owner: "test-owner",
        repo: "test-repo",
        issueNumber: 42,
        commit: { branch: "feature/42-branch" },
        currentConfiguration: { parentBranch: "develop" },
        branches: { development: "develop" },
        ai: undefined,
        ...overrides,
    } as Execution;
}

function mockContext(overrides: Partial<BugbotContext> = {}): BugbotContext {
    return {
        existingByFindingId: {
            "find-1": { issueCommentId: 1, resolved: false },
        },
        issueComments: [
            { id: 1, body: "## Null dereference\n\n**Location:** `src/foo.ts:10`\n\nDescription here." },
        ],
        openPrNumbers: [5],
        previousFindingsBlock: "",
        prContext: null,
        unresolvedFindingsWithBody: [
            { id: "find-1", fullBody: "## Null dereference\n\n**Location:** `src/foo.ts:10`\n\nDescription here." },
        ],
        ...overrides,
    };
}

describe("buildBugbotFixPrompt", () => {
    it("includes repo context, findings, user comment, and verify commands", () => {
        const param = mockExecution();
        const context = mockContext();
        const prompt = buildBugbotFixPrompt(
            param,
            context,
            ["find-1"],
            "please fix this",
            ["npm run build", "npm test"]
        );
        expect(prompt).toContain("test-owner");
        expect(prompt).toContain("test-repo");
        expect(prompt).toContain("feature/42-branch");
        expect(prompt).toContain("find-1");
        expect(prompt).toContain("please fix this");
        expect(prompt).toContain("npm run build");
        expect(prompt).toContain("npm test");
        expect(prompt).toContain("Fix only the problems described");
    });

    it("includes PR number when openPrNumbers is non-empty", () => {
        const prompt = buildBugbotFixPrompt(
            mockExecution(),
            mockContext(),
            ["find-1"],
            "fix it",
            []
        );
        expect(prompt).toContain("Pull request number: 5");
    });

    it("asks to run verify when verifyCommands is empty", () => {
        const prompt = buildBugbotFixPrompt(mockExecution(), mockContext(), ["find-1"], "fix", []);
        expect(prompt).toContain("Run any standard project checks");
    });

    it("truncates finding body when it exceeds 12000 characters and appends truncation indicator", () => {
        const longBody = "x".repeat(15000);
        const context = mockContext({
            issueComments: [{ id: 1, body: longBody }],
        });
        const prompt = buildBugbotFixPrompt(
            mockExecution(),
            context,
            ["find-1"],
            "fix",
            []
        );
        expect(prompt).toContain("find-1");
        expect(prompt).toContain("[... truncated for length ...]");
        const xCount = (prompt.match(/x/g) ?? []).length;
        expect(xCount).toBeLessThan(15000);
        expect(xCount).toBeLessThanOrEqual(12000);
    });
});
