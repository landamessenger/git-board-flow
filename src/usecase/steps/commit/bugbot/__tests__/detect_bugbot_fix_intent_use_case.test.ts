/**
 * Unit tests for DetectBugbotFixIntentUseCase: skip conditions, branch override, parent comment, OpenCode response.
 */

import { DetectBugbotFixIntentUseCase } from "../detect_bugbot_fix_intent_use_case";
import type { Execution } from "../../../../../data/model/execution";
import { Result } from "../../../../../data/model/result";

jest.mock("../../../../../utils/logger", () => ({
    logInfo: jest.fn(),
}));

const mockLoadBugbotContext = jest.fn();
const mockAskAgent = jest.fn();
const mockGetHeadBranchForIssue = jest.fn();
const mockGetPullRequestReviewCommentBody = jest.fn();

jest.mock("../load_bugbot_context_use_case", () => ({
    loadBugbotContext: (...args: unknown[]) => mockLoadBugbotContext(...args),
}));

jest.mock("../../../../../data/repository/ai_repository", () => ({
    AiRepository: jest.fn().mockImplementation(() => ({ askAgent: mockAskAgent })),
    OPENCODE_AGENT_PLAN: "plan",
}));

jest.mock("../../../../../data/repository/pull_request_repository", () => ({
    PullRequestRepository: jest.fn().mockImplementation(() => ({
        getHeadBranchForIssue: mockGetHeadBranchForIssue,
        getPullRequestReviewCommentBody: mockGetPullRequestReviewCommentBody,
    })),
}));

function baseExecution(overrides: Partial<Execution> = {}): Execution {
    return {
        owner: "o",
        repo: "r",
        issueNumber: 42,
        tokens: { token: "t" },
        commit: { branch: "feature/42-foo" },
        issue: {
            isIssueComment: true,
            isIssue: false,
            commentBody: "@bot fix it",
            number: 42,
            commentId: 1,
        },
        pullRequest: { isPullRequestReviewComment: false, commentBody: "", number: 0 },
        ai: { getOpencodeModel: () => "model", getOpencodeServerUrl: () => "http://localhost" },
        ...overrides,
    } as unknown as Execution;
}

function mockContextWithUnresolved(count = 1) {
    const unresolved = Array.from({ length: count }, (_, i) => ({
        id: `finding-${i}`,
        fullBody: `## Finding ${i}\n\nBody for ${i}.`,
    }));
    return {
        existingByFindingId: {} as Record<string, { resolved: boolean }>,
        issueComments: [],
        openPrNumbers: [],
        previousFindingsBlock: "",
        prContext: null,
        unresolvedFindingsWithBody: unresolved,
    };
}

describe("DetectBugbotFixIntentUseCase", () => {
    let useCase: DetectBugbotFixIntentUseCase;

    beforeEach(() => {
        useCase = new DetectBugbotFixIntentUseCase();
        mockLoadBugbotContext.mockReset();
        mockAskAgent.mockReset();
        mockGetHeadBranchForIssue.mockReset();
        mockGetPullRequestReviewCommentBody.mockReset();
    });

    it("returns empty results when OpenCode not configured", async () => {
        const param = baseExecution({
            ai: { getOpencodeModel: () => "", getOpencodeServerUrl: () => "http://x" } as Execution["ai"],
        });

        const results = await useCase.invoke(param);

        expect(results).toEqual([]);
        expect(mockLoadBugbotContext).not.toHaveBeenCalled();
    });

    it("returns empty results when issueNumber is -1", async () => {
        const results = await useCase.invoke(baseExecution({ issueNumber: -1 }));

        expect(results).toEqual([]);
        expect(mockLoadBugbotContext).not.toHaveBeenCalled();
    });

    it("returns empty results when comment body is empty", async () => {
        const results = await useCase.invoke(
            baseExecution({ issue: { ...baseExecution().issue, commentBody: "" } } as Partial<Execution>)
        );

        expect(results).toEqual([]);
        expect(mockLoadBugbotContext).not.toHaveBeenCalled();
    });

    it("returns empty results when no branch and getHeadBranchForIssue returns null", async () => {
        mockGetHeadBranchForIssue.mockResolvedValue(undefined);
        mockLoadBugbotContext.mockResolvedValue(mockContextWithUnresolved(1));

        const results = await useCase.invoke(
            baseExecution({ commit: { branch: "" } } as Partial<Execution>)
        );

        expect(mockGetHeadBranchForIssue).toHaveBeenCalledWith("o", "r", 42, "t");
        expect(results).toEqual([]);
    });

    it("uses branchOverride when commit.branch empty and getHeadBranchForIssue returns branch", async () => {
        mockGetHeadBranchForIssue.mockResolvedValue("feature/42-pr");
        mockLoadBugbotContext.mockResolvedValue(mockContextWithUnresolved(1));
        mockAskAgent.mockResolvedValue({ is_fix_request: false, target_finding_ids: [] });

        await useCase.invoke(baseExecution({ commit: { branch: "" } } as Partial<Execution>));

        expect(mockLoadBugbotContext).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ branchOverride: "feature/42-pr" })
        );
    });

    it("returns empty results when no unresolved findings", async () => {
        mockLoadBugbotContext.mockResolvedValue(mockContextWithUnresolved(0));

        const results = await useCase.invoke(baseExecution());

        expect(results).toEqual([]);
        expect(mockAskAgent).not.toHaveBeenCalled();
    });

    it("calls askAgent and returns payload with filtered target ids", async () => {
        const context = mockContextWithUnresolved(2);
        mockLoadBugbotContext.mockResolvedValue(context);
        mockAskAgent.mockResolvedValue({
            is_fix_request: true,
            target_finding_ids: ["finding-0", "finding-1", "invalid-id"],
        });

        const results = await useCase.invoke(baseExecution());

        expect(mockAskAgent).toHaveBeenCalledTimes(1);
        expect(results).toHaveLength(1);
        const payload = results[0].payload as { isFixRequest: boolean; targetFindingIds: string[] };
        expect(payload.isFixRequest).toBe(true);
        expect(payload.targetFindingIds).toEqual(["finding-0", "finding-1"]);
    });

    it("returns no response payload when askAgent returns null", async () => {
        mockLoadBugbotContext.mockResolvedValue(mockContextWithUnresolved(1));
        mockAskAgent.mockResolvedValue(null);

        const results = await useCase.invoke(baseExecution());

        expect(results).toHaveLength(1);
        expect((results[0].payload as { isFixRequest: boolean }).isFixRequest).toBe(false);
    });

    it("fetches parent comment body when PR review comment has commentInReplyToId", async () => {
        mockLoadBugbotContext.mockResolvedValue(mockContextWithUnresolved(1));
        mockGetPullRequestReviewCommentBody.mockResolvedValue("Parent body");
        mockAskAgent.mockResolvedValue({ is_fix_request: false, target_finding_ids: [] });

        await useCase.invoke(
            baseExecution({
                issue: { ...baseExecution().issue, isIssueComment: false },
                pullRequest: {
                    isPullRequestReviewComment: true,
                    commentBody: "fix it",
                    number: 50,
                    commentInReplyToId: 999,
                },
            } as Partial<Execution>)
        );

        expect(mockGetPullRequestReviewCommentBody).toHaveBeenCalledWith("o", "r", 50, 999, "t");
        expect(mockAskAgent).toHaveBeenCalledWith(
            expect.anything(),
            "plan",
            expect.stringContaining("Parent body"),
            expect.anything()
        );
    });
});
