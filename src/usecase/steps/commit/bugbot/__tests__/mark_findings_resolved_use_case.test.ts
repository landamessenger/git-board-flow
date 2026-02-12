/**
 * Unit tests for markFindingsResolved: skip when already resolved or not in resolved set,
 * update issue comment, update PR comment and resolve thread, handle missing comment errors.
 */

import { markFindingsResolved } from "../mark_findings_resolved_use_case";
import { IssueRepository } from "../../../../../data/repository/issue_repository";
import { PullRequestRepository } from "../../../../../data/repository/pull_request_repository";
import type { BugbotContext, ExistingByFindingId } from "../types";
import type { Execution } from "../../../../../data/model/execution";

jest.mock("../../../../../utils/logger", () => ({
    logInfo: jest.fn(),
    logDebugInfo: jest.fn(),
    logError: jest.fn(),
}));

const mockUpdateComment = jest.fn();
const mockListPrReviewComments = jest.fn();
const mockUpdatePrReviewComment = jest.fn();
const mockResolveThread = jest.fn();

jest.mock("../../../../../data/repository/issue_repository", () => ({
    IssueRepository: jest.fn().mockImplementation(() => ({
        updateComment: mockUpdateComment,
    })),
}));

jest.mock("../../../../../data/repository/pull_request_repository", () => ({
    PullRequestRepository: jest.fn().mockImplementation(() => ({
        listPullRequestReviewComments: mockListPrReviewComments,
        updatePullRequestReviewComment: mockUpdatePrReviewComment,
        resolvePullRequestReviewThread: mockResolveThread,
    })),
}));

function baseExecution(overrides: Partial<Execution> = {}): Execution {
    return {
        owner: "o",
        repo: "r",
        issueNumber: 1,
        tokens: { token: "t" },
        ...overrides,
    } as unknown as Execution;
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

describe("markFindingsResolved", () => {
    beforeEach(() => {
        mockUpdateComment.mockReset();
        mockListPrReviewComments.mockReset();
        mockUpdatePrReviewComment.mockReset();
        mockResolveThread.mockReset();
    });

    it("skips finding when existing.resolved is true", async () => {
        const existing: ExistingByFindingId = {
            f1: {
                issueCommentId: 100,
                resolved: true,
            },
        };
        const context = baseContext({
            existingByFindingId: existing,
            issueComments: [{ id: 100, body: "text" }],
        });

        await markFindingsResolved({
            execution: baseExecution(),
            context,
            resolvedFindingIds: new Set(["f1"]),
            normalizedResolvedIds: new Set(),
        });

        expect(mockUpdateComment).not.toHaveBeenCalled();
    });

    it("skips finding when not in resolvedFindingIds or normalizedResolvedIds", async () => {
        const existing: ExistingByFindingId = {
            f1: { issueCommentId: 100, resolved: false },
        };
        const context = baseContext({
            existingByFindingId: existing,
            issueComments: [{ id: 100, body: "text" }],
        });

        await markFindingsResolved({
            execution: baseExecution(),
            context,
            resolvedFindingIds: new Set(),
            normalizedResolvedIds: new Set(),
        });

        expect(mockUpdateComment).not.toHaveBeenCalled();
    });

    it("updates issue comment when finding is resolved and comment exists", async () => {
        const bodyWithMarker =
            '## Finding\n\n<!-- copilot-bugbot finding_id:"f1" resolved:false -->';
        const existing: ExistingByFindingId = {
            f1: { issueCommentId: 100, resolved: false },
        };
        const context = baseContext({
            existingByFindingId: existing,
            issueComments: [{ id: 100, body: bodyWithMarker }],
        });

        await markFindingsResolved({
            execution: baseExecution(),
            context,
            resolvedFindingIds: new Set(["f1"]),
            normalizedResolvedIds: new Set(),
        });

        expect(mockUpdateComment).toHaveBeenCalledTimes(1);
        expect(mockUpdateComment).toHaveBeenCalledWith(
            "o",
            "r",
            1,
            100,
            expect.stringContaining("Resolved"),
            "t"
        );
        expect(mockUpdateComment).toHaveBeenCalledWith(
            "o",
            "r",
            1,
            100,
            expect.stringMatching(/resolved:true/),
            "t"
        );
    });

    it("does not call updateComment when issue comment is not found", async () => {
        const existing: ExistingByFindingId = {
            f1: { issueCommentId: 999, resolved: false },
        };
        const context = baseContext({
            existingByFindingId: existing,
            issueComments: [{ id: 100, body: "other" }],
        });

        await markFindingsResolved({
            execution: baseExecution(),
            context,
            resolvedFindingIds: new Set(["f1"]),
            normalizedResolvedIds: new Set(),
        });

        expect(mockUpdateComment).not.toHaveBeenCalled();
    });

    it("uses normalizedResolvedIds when findingId is not in resolvedFindingIds", async () => {
        const bodyWithMarker =
            '## Finding\n\n<!-- copilot-bugbot finding_id:"f-1" resolved:false -->';
        const existing: ExistingByFindingId = {
            "f-1": { issueCommentId: 100, resolved: false },
        };
        const context = baseContext({
            existingByFindingId: existing,
            issueComments: [{ id: 100, body: bodyWithMarker }],
        });
        // sanitizeFindingIdForMarker("f-1") is "f-1", so normalizedResolvedIds must contain "f-1"
        await markFindingsResolved({
            execution: baseExecution(),
            context,
            resolvedFindingIds: new Set(),
            normalizedResolvedIds: new Set(["f-1"]),
        });

        expect(mockUpdateComment).toHaveBeenCalledTimes(1);
    });

    it("updates PR review comment and resolves thread when prCommentId is set", async () => {
        const bodyWithMarker =
            '## Finding\n\n<!-- copilot-bugbot finding_id:"f1" resolved:false -->';
        const existing: ExistingByFindingId = {
            f1: {
                issueCommentId: 100,
                prCommentId: 201,
                prNumber: 5,
                resolved: false,
            },
        };
        const context = baseContext({
            existingByFindingId: existing,
            issueComments: [{ id: 100, body: bodyWithMarker }],
        });
        mockListPrReviewComments.mockResolvedValue([
            { id: 201, body: bodyWithMarker, node_id: "NODE_201" },
        ]);

        await markFindingsResolved({
            execution: baseExecution(),
            context,
            resolvedFindingIds: new Set(["f1"]),
            normalizedResolvedIds: new Set(),
        });

        expect(mockUpdateComment).toHaveBeenCalledTimes(1);
        expect(mockListPrReviewComments).toHaveBeenCalledWith("o", "r", 5, "t");
        expect(mockUpdatePrReviewComment).toHaveBeenCalledWith(
            "o",
            "r",
            201,
            expect.stringMatching(/resolved:true/),
            "t"
        );
        expect(mockResolveThread).toHaveBeenCalledWith(
            "o",
            "r",
            5,
            "NODE_201",
            "t"
        );
    });

    it("does not resolve thread when pr comment has no node_id", async () => {
        const bodyWithMarker =
            '## Finding\n\n<!-- copilot-bugbot finding_id:"f1" resolved:false -->';
        const existing: ExistingByFindingId = {
            f1: {
                prCommentId: 202,
                prNumber: 6,
                resolved: false,
            },
        };
        const context = baseContext({
            existingByFindingId: existing,
            issueComments: [],
        });
        mockListPrReviewComments.mockResolvedValue([
            { id: 202, body: bodyWithMarker },
        ]);

        await markFindingsResolved({
            execution: baseExecution(),
            context,
            resolvedFindingIds: new Set(["f1"]),
            normalizedResolvedIds: new Set(),
        });

        expect(mockUpdatePrReviewComment).toHaveBeenCalledTimes(1);
        expect(mockResolveThread).not.toHaveBeenCalled();
    });

    it("logs error when PR review comment is not found for finding", async () => {
        const { logError } = require("../../../../../utils/logger");
        const existing: ExistingByFindingId = {
            f1: {
                issueCommentId: 100,
                prCommentId: 999,
                prNumber: 5,
                resolved: false,
            },
        };
        const context = baseContext({
            existingByFindingId: existing,
            issueComments: [],
        });
        mockListPrReviewComments.mockResolvedValue([
            { id: 201, body: "other", node_id: "NODE_201" },
        ]);

        await markFindingsResolved({
            execution: baseExecution(),
            context,
            resolvedFindingIds: new Set(["f1"]),
            normalizedResolvedIds: new Set(),
        });

        expect(logError).toHaveBeenCalledWith(
            expect.stringContaining("No se encontró el comentario de la PR")
        );
        expect(mockUpdatePrReviewComment).not.toHaveBeenCalled();
    });

    it("logs error when updatePullRequestReviewComment throws", async () => {
        const { logError } = require("../../../../../utils/logger");
        const bodyWithMarker =
            '## Finding\n\n<!-- copilot-bugbot finding_id:"f1" resolved:false -->';
        const existing: ExistingByFindingId = {
            f1: {
                issueCommentId: 100,
                prCommentId: 201,
                prNumber: 5,
                resolved: false,
            },
        };
        const context = baseContext({
            existingByFindingId: existing,
            issueComments: [{ id: 100, body: bodyWithMarker }],
        });
        mockListPrReviewComments.mockResolvedValue([
            { id: 201, body: bodyWithMarker, node_id: "NODE_201" },
        ]);
        mockUpdatePrReviewComment.mockRejectedValueOnce(new Error("PR API error"));

        await markFindingsResolved({
            execution: baseExecution(),
            context,
            resolvedFindingIds: new Set(["f1"]),
            normalizedResolvedIds: new Set(),
        });

        expect(logError).toHaveBeenCalledWith(
            expect.stringContaining("Error al actualizar comentario de revisión")
        );
    });

    it("does not call update when replaceMarkerInBody finds no marker (body without marker)", async () => {
        const existing: ExistingByFindingId = {
            f1: { issueCommentId: 100, resolved: false },
        };
        const context = baseContext({
            existingByFindingId: existing,
            issueComments: [{ id: 100, body: "plain text without marker" }],
        });

        await markFindingsResolved({
            execution: baseExecution(),
            context,
            resolvedFindingIds: new Set(["f1"]),
            normalizedResolvedIds: new Set(),
        });

        expect(mockUpdateComment).not.toHaveBeenCalled();
    });

    it("catches and logs error when issue updateComment throws", async () => {
        const bodyWithMarker =
            '## Finding\n\n<!-- copilot-bugbot finding_id:"f1" resolved:false -->';
        const existing: ExistingByFindingId = {
            f1: { issueCommentId: 100, resolved: false },
        };
        const context = baseContext({
            existingByFindingId: existing,
            issueComments: [{ id: 100, body: bodyWithMarker }],
        });
        mockUpdateComment.mockRejectedValueOnce(new Error("API error"));

        await expect(
            markFindingsResolved({
                execution: baseExecution(),
                context,
                resolvedFindingIds: new Set(["f1"]),
                normalizedResolvedIds: new Set(),
            })
        ).resolves.toBeUndefined();

        expect(mockUpdateComment).toHaveBeenCalled();
    });
});
