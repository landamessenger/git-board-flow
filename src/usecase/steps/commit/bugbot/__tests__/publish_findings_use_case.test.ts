/**
 * Unit tests for publishFindings: issue comments (add/update), PR review comments (when file in prFiles), overflow.
 */

import { publishFindings } from "../publish_findings_use_case";
import type { BugbotFinding } from "../types";
import type { BugbotContext } from "../types";

jest.mock("../../../../../utils/logger", () => ({
    logDebugInfo: jest.fn(),
    logInfo: jest.fn(),
}));

const mockAddComment = jest.fn();
const mockUpdateComment = jest.fn();
const mockCreateReviewWithComments = jest.fn();
const mockUpdatePullRequestReviewComment = jest.fn();

jest.mock("../../../../../data/repository/issue_repository", () => ({
    IssueRepository: jest.fn().mockImplementation(() => ({
        addComment: mockAddComment,
        updateComment: mockUpdateComment,
    })),
}));

jest.mock("../../../../../data/repository/pull_request_repository", () => ({
    PullRequestRepository: jest.fn().mockImplementation(() => ({
        createReviewWithComments: mockCreateReviewWithComments,
        updatePullRequestReviewComment: mockUpdatePullRequestReviewComment,
    })),
}));

function finding(overrides: Partial<BugbotFinding> = {}): BugbotFinding {
    return {
        id: "f1",
        title: "Test",
        description: "Desc",
        ...overrides,
    };
}

function baseContext(overrides: Partial<BugbotContext> = {}): BugbotContext {
    return {
        existingByFindingId: {},
        issueComments: [],
        openPrNumbers: [],
        previousFindingsBlock: "",
        prContext: null,
        unresolvedFindingsWithBody: [],
        ...overrides,
    };
}

const baseExecution = {
    owner: "o",
    repo: "r",
    issueNumber: 42,
    tokens: { token: "t" },
} as Parameters<typeof publishFindings>[0]["execution"];

describe("publishFindings", () => {
    beforeEach(() => {
        mockAddComment.mockReset().mockResolvedValue(undefined);
        mockUpdateComment.mockReset().mockResolvedValue(undefined);
        mockCreateReviewWithComments.mockReset().mockResolvedValue(undefined);
        mockUpdatePullRequestReviewComment.mockReset().mockResolvedValue(undefined);
    });

    it("adds issue comment for new finding", async () => {
        await publishFindings({
            execution: baseExecution,
            context: baseContext(),
            findings: [finding()],
        });

        expect(mockAddComment).toHaveBeenCalledTimes(1);
        expect(mockAddComment).toHaveBeenCalledWith("o", "r", 42, expect.stringContaining("## Test"), "t");
        expect(mockUpdateComment).not.toHaveBeenCalled();
    });

    it("updates issue comment when finding already has issueCommentId", async () => {
        await publishFindings({
            execution: baseExecution,
            context: baseContext({
                existingByFindingId: { f1: { issueCommentId: 100, resolved: false } },
            }),
            findings: [finding()],
        });

        expect(mockUpdateComment).toHaveBeenCalledWith("o", "r", 42, 100, expect.any(String), "t");
        expect(mockAddComment).not.toHaveBeenCalled();
    });

    it("creates PR review comment when finding.file is in prFiles", async () => {
        await publishFindings({
            execution: baseExecution,
            context: baseContext({
                openPrNumbers: [50],
                prContext: {
                    prHeadSha: "sha1",
                    prFiles: [{ filename: "src/foo.ts", status: "modified" }],
                    pathToFirstDiffLine: { "src/foo.ts": 5 },
                },
            }),
            findings: [finding({ file: "src/foo.ts", line: 10 })],
        });

        expect(mockAddComment).toHaveBeenCalledTimes(1);
        expect(mockCreateReviewWithComments).toHaveBeenCalledTimes(1);
        expect(mockCreateReviewWithComments).toHaveBeenCalledWith(
            "o",
            "r",
            50,
            "sha1",
            expect.arrayContaining([
                expect.objectContaining({ path: "src/foo.ts", line: 10, body: expect.any(String) }),
            ]),
            "t"
        );
    });

    it("does not create PR review comment when finding.file is not in prFiles", async () => {
        await publishFindings({
            execution: baseExecution,
            context: baseContext({
                openPrNumbers: [50],
                prContext: {
                    prHeadSha: "sha1",
                    prFiles: [{ filename: "src/bar.ts", status: "modified" }],
                    pathToFirstDiffLine: {},
                },
            }),
            findings: [finding({ file: "src/foo.ts" })],
        });

        expect(mockAddComment).toHaveBeenCalledTimes(1);
        expect(mockCreateReviewWithComments).not.toHaveBeenCalled();
    });

    it("uses pathToFirstDiffLine when finding has no line", async () => {
        await publishFindings({
            execution: baseExecution,
            context: baseContext({
                openPrNumbers: [50],
                prContext: {
                    prHeadSha: "sha1",
                    prFiles: [{ filename: "src/a.ts", status: "modified" }],
                    pathToFirstDiffLine: { "src/a.ts": 20 },
                },
            }),
            findings: [finding({ id: "f2", file: "src/a.ts" })],
        });

        expect(mockCreateReviewWithComments).toHaveBeenCalledWith(
            "o",
            "r",
            50,
            "sha1",
            expect.arrayContaining([
                expect.objectContaining({ path: "src/a.ts", line: 20 }),
            ]),
            "t"
        );
    });

    it("updates existing PR review comment when finding has prCommentId for same PR", async () => {
        await publishFindings({
            execution: baseExecution,
            context: baseContext({
                openPrNumbers: [50],
                existingByFindingId: { f1: { prCommentId: 300, prNumber: 50, resolved: false } },
                prContext: {
                    prHeadSha: "sha1",
                    prFiles: [{ filename: "src/foo.ts", status: "modified" }],
                    pathToFirstDiffLine: {},
                },
            }),
            findings: [finding({ file: "src/foo.ts" })],
        });

        expect(mockUpdatePullRequestReviewComment).toHaveBeenCalledWith(
            "o",
            "r",
            300,
            expect.any(String),
            "t"
        );
        expect(mockCreateReviewWithComments).not.toHaveBeenCalled();
    });

    it("adds overflow comment when overflowCount > 0", async () => {
        await publishFindings({
            execution: baseExecution,
            context: baseContext(),
            findings: [finding()],
            overflowCount: 3,
            overflowTitles: ["Extra 1", "Extra 2", "Extra 3"],
        });

        expect(mockAddComment).toHaveBeenCalledTimes(2);
        const overflowCall = mockAddComment.mock.calls.find(
            (c: unknown[]) => (c[3] as string).includes("More findings")
        );
        expect(overflowCall).toBeDefined();
        expect(overflowCall[3]).toContain("3");
        expect(overflowCall[3]).toContain("Extra 1");
    });
});
