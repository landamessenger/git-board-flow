/**
 * Unit tests for getHeadBranchForIssue issue-number matching (bounded matching to avoid false positives).
 */

import { PullRequestRepository } from "../pull_request_repository";

jest.mock("../../../utils/logger", () => ({
    logDebugInfo: jest.fn(),
    logError: jest.fn(),
}));

const mockPullsList = jest.fn();
jest.mock("@actions/github", () => ({
    getOctokit: () => ({
        rest: {
            pulls: {
                list: (...args: unknown[]) => mockPullsList(...args),
            },
        },
    }),
}));

describe("getHeadBranchForIssue", () => {
    const repo = new PullRequestRepository();

    beforeEach(() => {
        mockPullsList.mockReset();
    });

    it("matches body with exact #123 and returns that PR head ref", async () => {
        mockPullsList.mockResolvedValue({
            data: [
                { number: 1, body: "Fixes #123", head: { ref: "feature/123-fix" } },
            ],
        });
        const branch = await repo.getHeadBranchForIssue("o", "r", 123, "token");
        expect(branch).toBe("feature/123-fix");
    });

    it("does not match body #1234 when looking for issue 123", async () => {
        mockPullsList.mockResolvedValue({
            data: [
                { number: 1, body: "Fixes #1234", head: { ref: "feature/1234-fix" } },
            ],
        });
        const branch = await repo.getHeadBranchForIssue("o", "r", 123, "token");
        expect(branch).toBeUndefined();
    });

    it("does not match body #12 when looking for issue 123", async () => {
        mockPullsList.mockResolvedValue({
            data: [
                { number: 1, body: "Fixes #12", head: { ref: "feature/12-fix" } },
            ],
        });
        const branch = await repo.getHeadBranchForIssue("o", "r", 123, "token");
        expect(branch).toBeUndefined();
    });

    it("matches headRef with bounded 123 (feature/123-fix)", async () => {
        mockPullsList.mockResolvedValue({
            data: [
                { number: 1, body: "", head: { ref: "feature/123-fix" } },
            ],
        });
        const branch = await repo.getHeadBranchForIssue("o", "r", 123, "token");
        expect(branch).toBe("feature/123-fix");
    });

    it("does not match headRef feature/1234-fix when looking for issue 123", async () => {
        mockPullsList.mockResolvedValue({
            data: [
                { number: 1, body: "", head: { ref: "feature/1234-fix" } },
            ],
        });
        const branch = await repo.getHeadBranchForIssue("o", "r", 123, "token");
        expect(branch).toBeUndefined();
    });

    it("does not match headRef feature/12-fix when looking for issue 123", async () => {
        mockPullsList.mockResolvedValue({
            data: [
                { number: 1, body: "", head: { ref: "feature/12-fix" } },
            ],
        });
        const branch = await repo.getHeadBranchForIssue("o", "r", 123, "token");
        expect(branch).toBeUndefined();
    });

    it("returns first matching PR when multiple match", async () => {
        mockPullsList.mockResolvedValue({
            data: [
                { number: 1, body: "Closes #99", head: { ref: "feature/99-a" } },
                { number: 2, body: "Fixes #123", head: { ref: "feature/123-b" } },
            ],
        });
        const branch = await repo.getHeadBranchForIssue("o", "r", 123, "token");
        expect(branch).toBe("feature/123-b");
    });

    it("returns undefined when pulls.list throws", async () => {
        mockPullsList.mockRejectedValue(new Error("API error"));
        const branch = await repo.getHeadBranchForIssue("o", "r", 123, "token");
        expect(branch).toBeUndefined();
    });
});
