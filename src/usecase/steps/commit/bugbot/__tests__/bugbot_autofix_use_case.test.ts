/**
 * Unit tests for BugbotAutofixUseCase: skip when no targets/OpenCode, context load vs provided, copilotMessage call.
 */

import { BugbotAutofixUseCase } from "../bugbot_autofix_use_case";
import type { BugbotContext } from "../types";

jest.mock("../../../../../utils/logger", () => ({
    logInfo: jest.fn(),
    logDebugInfo: jest.fn(),
    logError: jest.fn(),
}));

const mockLoadBugbotContext = jest.fn();
const mockCopilotMessage = jest.fn();

jest.mock("../load_bugbot_context_use_case", () => ({
    loadBugbotContext: (...args: unknown[]) => mockLoadBugbotContext(...args),
}));

jest.mock("../../../../../data/repository/ai_repository", () => ({
    AiRepository: jest.fn().mockImplementation(() => ({
        copilotMessage: mockCopilotMessage,
    })),
}));

function baseExecution() {
    return {
        owner: "o",
        repo: "r",
        issueNumber: 42,
        tokens: { token: "t" },
        commit: { branch: "feature/42-foo" },
        currentConfiguration: { parentBranch: "develop" },
        branches: { development: "develop" },
        ai: {
            getOpencodeServerUrl: () => "http://localhost",
            getOpencodeModel: () => "model",
            getBugbotFixVerifyCommands: () => ["npm test"],
        },
    } as Parameters<BugbotAutofixUseCase["invoke"]>[0]["execution"];
}

function contextWithFindings(ids: string[]) {
    const existingByFindingId: BugbotContext["existingByFindingId"] = {};
    const issueComments: BugbotContext["issueComments"] = [];
    ids.forEach((id, i) => {
        existingByFindingId[id] = {
            issueCommentId: 100 + i,
            resolved: false,
        };
        issueComments.push({
            id: 100 + i,
            body: `## Finding ${id}\n\nDescription.\n\n<!-- copilot-bugbot finding_id:"${id}" resolved:false -->`,
        });
    });
    return {
        existingByFindingId,
        issueComments,
        openPrNumbers: [] as number[],
        previousFindingsBlock: "",
        prContext: null,
        unresolvedFindingsWithBody: ids.map((id) => ({ id, fullBody: `Body ${id}` })),
    } as BugbotContext;
}

describe("BugbotAutofixUseCase", () => {
    let useCase: BugbotAutofixUseCase;

    beforeEach(() => {
        useCase = new BugbotAutofixUseCase();
        mockLoadBugbotContext.mockReset();
        mockCopilotMessage.mockReset();
    });

    it("returns empty results when targetFindingIds is empty", async () => {
        const results = await useCase.invoke({
            execution: baseExecution(),
            targetFindingIds: [],
            userComment: "fix it",
        });

        expect(results).toEqual([]);
        expect(mockLoadBugbotContext).not.toHaveBeenCalled();
        expect(mockCopilotMessage).not.toHaveBeenCalled();
    });

    it("returns empty results when OpenCode not configured", async () => {
        const exec = baseExecution();
        (exec as { ai?: unknown }).ai = {
            getOpencodeServerUrl: () => "",
            getOpencodeModel: () => "model",
        };

        const results = await useCase.invoke({
            execution: exec,
            targetFindingIds: ["f1"],
            userComment: "fix it",
        });

        expect(results).toEqual([]);
        expect(mockCopilotMessage).not.toHaveBeenCalled();
    });

    it("uses provided context when passed", async () => {
        const ctx = contextWithFindings(["f1"]);
        mockCopilotMessage.mockResolvedValue({ text: "Done.", sessionId: "s1" });

        await useCase.invoke({
            execution: baseExecution(),
            targetFindingIds: ["f1"],
            userComment: "fix it",
            context: ctx,
        });

        expect(mockLoadBugbotContext).not.toHaveBeenCalled();
        expect(mockCopilotMessage).toHaveBeenCalledTimes(1);
    });

    it("loads context when not provided", async () => {
        const ctx = contextWithFindings(["f1"]);
        mockLoadBugbotContext.mockResolvedValue(ctx);
        mockCopilotMessage.mockResolvedValue({ text: "Done.", sessionId: "s1" });

        await useCase.invoke({
            execution: baseExecution(),
            targetFindingIds: ["f1"],
            userComment: "fix it",
        });

        expect(mockLoadBugbotContext).toHaveBeenCalledTimes(1);
        expect(mockCopilotMessage).toHaveBeenCalledTimes(1);
    });

    it("filters to only valid unresolved target ids", async () => {
        const ctx = contextWithFindings(["f1", "f2"]);
        mockCopilotMessage.mockResolvedValue({ text: "Done.", sessionId: "s1" });

        const results = await useCase.invoke({
            execution: baseExecution(),
            targetFindingIds: ["f1", "f2", "nonexistent"],
            userComment: "fix all",
            context: ctx,
        });

        expect(results).toHaveLength(1);
        expect((results[0].payload as { targetFindingIds: string[] }).targetFindingIds).toEqual([
            "f1",
            "f2",
        ]);
    });

    it("returns empty results when all target findings are already resolved", async () => {
        const ctx = contextWithFindings(["f1", "f2"]);
        ctx.existingByFindingId["f1"] = { ...ctx.existingByFindingId["f1"]!, resolved: true };
        ctx.existingByFindingId["f2"] = { ...ctx.existingByFindingId["f2"]!, resolved: true };

        const results = await useCase.invoke({
            execution: baseExecution(),
            targetFindingIds: ["f1", "f2"],
            userComment: "fix all",
            context: ctx,
        });

        expect(results).toEqual([]);
        expect(mockCopilotMessage).not.toHaveBeenCalled();
    });

    it("returns failure when copilotMessage returns no text", async () => {
        const ctx = contextWithFindings(["f1"]);
        mockCopilotMessage.mockResolvedValue(null);

        const results = await useCase.invoke({
            execution: baseExecution(),
            targetFindingIds: ["f1"],
            userComment: "fix it",
            context: ctx,
        });

        expect(results).toHaveLength(1);
        expect(results[0].success).toBe(false);
        expect(results[0].errors).toBeDefined();
    });

    it("returns success and payload when copilotMessage returns text", async () => {
        const ctx = contextWithFindings(["f1"]);
        mockCopilotMessage.mockResolvedValue({ text: "Fixed.", sessionId: "s1" });

        const results = await useCase.invoke({
            execution: baseExecution(),
            targetFindingIds: ["f1"],
            userComment: "fix it",
            context: ctx,
        });

        expect(results).toHaveLength(1);
        expect(results[0].success).toBe(true);
        expect(results[0].payload).toEqual(expect.objectContaining({ targetFindingIds: ["f1"] }));
    });
});
