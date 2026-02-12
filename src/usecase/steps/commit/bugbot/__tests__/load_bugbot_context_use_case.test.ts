/**
 * Unit tests for loadBugbotContext: issue/PR comment parsing, open PRs, previousFindingsBlock, prContext.
 */

import { loadBugbotContext } from "../load_bugbot_context_use_case";
import type { Execution } from "../../../../../data/model/execution";

jest.mock("../../../../../utils/logger", () => ({
    logDebugInfo: jest.fn(),
}));

const mockListIssueComments = jest.fn();
const mockGetOpenPullRequestNumbersByHeadBranch = jest.fn();
const mockListPullRequestReviewComments = jest.fn();
const mockGetPullRequestHeadSha = jest.fn();
const mockGetChangedFiles = jest.fn();
const mockGetFilesWithFirstDiffLine = jest.fn();

jest.mock("../../../../../data/repository/issue_repository", () => ({
    IssueRepository: jest.fn().mockImplementation(() => ({
        listIssueComments: mockListIssueComments,
    })),
}));

jest.mock("../../../../../data/repository/pull_request_repository", () => ({
    PullRequestRepository: jest.fn().mockImplementation(() => ({
        getOpenPullRequestNumbersByHeadBranch: mockGetOpenPullRequestNumbersByHeadBranch,
        listPullRequestReviewComments: mockListPullRequestReviewComments,
        getPullRequestHeadSha: mockGetPullRequestHeadSha,
        getChangedFiles: mockGetChangedFiles,
        getFilesWithFirstDiffLine: mockGetFilesWithFirstDiffLine,
    })),
}));

function baseParam(overrides: Partial<Execution> = {}): Execution {
    return {
        owner: "o",
        repo: "r",
        issueNumber: 42,
        tokens: { token: "t" },
        commit: { branch: "feature/42-foo" },
        currentConfiguration: {},
        branches: { development: "develop" },
        ...overrides,
    } as unknown as Execution;
}

describe("loadBugbotContext", () => {
    beforeEach(() => {
        mockListIssueComments.mockReset().mockResolvedValue([]);
        mockGetOpenPullRequestNumbersByHeadBranch.mockReset().mockResolvedValue([]);
        mockListPullRequestReviewComments.mockReset().mockResolvedValue([]);
        mockGetPullRequestHeadSha.mockReset();
        mockGetChangedFiles.mockReset();
        mockGetFilesWithFirstDiffLine.mockReset();
    });

    it("returns empty existingByFindingId and previousFindingsBlock when no issue comments", async () => {
        const ctx = await loadBugbotContext(baseParam());

        expect(ctx.existingByFindingId).toEqual({});
        expect(ctx.previousFindingsBlock).toBe("");
        expect(ctx.unresolvedFindingsWithBody).toEqual([]);
    });

    it("returns empty context and does not call APIs when head branch is empty (no branchOverride, empty commit.branch)", async () => {
        const ctx = await loadBugbotContext(
            baseParam({ commit: { branch: "" } } as unknown as Partial<Execution>)
        );

        expect(ctx.existingByFindingId).toEqual({});
        expect(ctx.issueComments).toEqual([]);
        expect(ctx.openPrNumbers).toEqual([]);
        expect(ctx.previousFindingsBlock).toBe("");
        expect(ctx.prContext).toBeNull();
        expect(ctx.unresolvedFindingsWithBody).toEqual([]);
        expect(mockGetOpenPullRequestNumbersByHeadBranch).not.toHaveBeenCalled();
        expect(mockListIssueComments).not.toHaveBeenCalled();
    });

    it("parses issue comments with markers and populates existingByFindingId", async () => {
        mockListIssueComments.mockResolvedValue([
            {
                id: 100,
                body: "## Finding A\n\n<!-- copilot-bugbot finding_id:\"id-a\" resolved:false -->",
            },
            {
                id: 101,
                body: "## Finding B\n\n<!-- copilot-bugbot finding_id:\"id-b\" resolved:true -->",
            },
        ]);

        const ctx = await loadBugbotContext(baseParam());

        expect(ctx.existingByFindingId["id-a"]).toEqual({ issueCommentId: 100, resolved: false });
        expect(ctx.existingByFindingId["id-b"]).toEqual({ issueCommentId: 101, resolved: true });
    });

    it("includes only unresolved findings in previousFindingsBlock and unresolvedFindingsWithBody", async () => {
        mockListIssueComments.mockResolvedValue([
            {
                id: 100,
                body: "## Open\n\n<!-- copilot-bugbot finding_id:\"open-1\" resolved:false -->",
            },
            {
                id: 101,
                body: "## Closed\n\n<!-- copilot-bugbot finding_id:\"closed-1\" resolved:true -->",
            },
        ]);

        const ctx = await loadBugbotContext(baseParam());

        expect(ctx.previousFindingsBlock).toContain("open-1");
        expect(ctx.previousFindingsBlock).not.toContain("closed-1");
        expect(ctx.unresolvedFindingsWithBody).toHaveLength(1);
        expect(ctx.unresolvedFindingsWithBody[0].id).toBe("open-1");
    });

    it("uses branchOverride for head branch when provided", async () => {
        mockGetOpenPullRequestNumbersByHeadBranch.mockResolvedValue([50]);

        await loadBugbotContext(
            baseParam({ commit: { branch: "" } } as unknown as Partial<Execution>),
            { branchOverride: "feature/42-from-pr" }
        );

        expect(mockGetOpenPullRequestNumbersByHeadBranch).toHaveBeenCalledWith(
            "o",
            "r",
            "feature/42-from-pr",
            "t"
        );
    });

    it("builds prContext when open PR exists and head sha is available", async () => {
        mockGetOpenPullRequestNumbersByHeadBranch.mockResolvedValue([50]);
        mockGetPullRequestHeadSha.mockResolvedValue("abc123");
        mockGetChangedFiles.mockResolvedValue([
            { filename: "src/foo.ts", status: "modified" },
        ]);
        mockGetFilesWithFirstDiffLine.mockResolvedValue([
            { path: "src/foo.ts", firstLine: 10 },
        ]);

        const ctx = await loadBugbotContext(baseParam());

        expect(ctx.openPrNumbers).toEqual([50]);
        expect(ctx.prContext).not.toBeNull();
        expect(ctx.prContext?.prHeadSha).toBe("abc123");
        expect(ctx.prContext?.prFiles).toHaveLength(1);
        expect(ctx.prContext?.prFiles[0].filename).toBe("src/foo.ts");
        expect(ctx.prContext?.pathToFirstDiffLine["src/foo.ts"]).toBe(10);
    });

    it("leaves prContext null when no open PRs", async () => {
        const ctx = await loadBugbotContext(baseParam());

        expect(ctx.prContext).toBeNull();
    });

    it("merges PR review comment markers into existingByFindingId", async () => {
        mockListIssueComments.mockResolvedValue([]);
        mockGetOpenPullRequestNumbersByHeadBranch.mockResolvedValue([50]);
        mockListPullRequestReviewComments.mockResolvedValue([
            {
                id: 200,
                body: "## PR finding\n\n<!-- copilot-bugbot finding_id:\"pr-f1\" resolved:false -->",
            },
        ]);

        const ctx = await loadBugbotContext(baseParam());

        expect(ctx.existingByFindingId["pr-f1"]).toEqual({
            prCommentId: 200,
            prNumber: 50,
            resolved: false,
        });
    });

    it("truncates fullBody to 12000 chars when loading from issue comments and appends truncation indicator", async () => {
        const longBody =
            "## Finding\n\n" + "x".repeat(15000) + "\n\n<!-- copilot-bugbot finding_id:\"long-1\" resolved:false -->";
        mockListIssueComments.mockResolvedValue([
            {
                id: 100,
                body: longBody,
            },
        ]);

        const ctx = await loadBugbotContext(baseParam());

        expect(ctx.unresolvedFindingsWithBody).toHaveLength(1);
        expect(ctx.unresolvedFindingsWithBody[0].id).toBe("long-1");
        expect(ctx.unresolvedFindingsWithBody[0].fullBody).toContain("[... truncated for length ...]");
        expect(ctx.unresolvedFindingsWithBody[0].fullBody.length).toBeLessThanOrEqual(12000);
    });
});
