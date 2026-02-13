/**
 * Unit tests for createLinkedBranch: GraphQL ref escaping so branch names with " or \ do not break the query.
 */

import { BranchRepository } from "../branch_repository";

jest.mock("../../../utils/logger", () => ({
    logDebugInfo: jest.fn(),
    logError: jest.fn(),
}));

const mockGraphql = jest.fn();
jest.mock("@actions/github", () => ({
    getOctokit: () => ({
        graphql: (...args: unknown[]) => mockGraphql(...args),
    }),
}));

describe("BranchRepository", () => {
    const repo = new BranchRepository();

    describe("formatBranchName", () => {
        it("lowercases and replaces spaces with single dash", () => {
            expect(repo.formatBranchName("Hello World", 1)).toBe("hello-world");
        });
        it("strips leading/trailing dashes", () => {
            expect(repo.formatBranchName("  - foo -  ", 1)).toBe("foo");
        });
        it("sanitizes to alphanumeric and dashes (dashes removed in late step)", () => {
            expect(repo.formatBranchName("1-my-feature", 1)).toBe("1myfeature");
        });
        it("collapses multiple dashes then strips non-alphanumeric", () => {
            expect(repo.formatBranchName("a---b", 2)).toBe("ab");
        });
    });
});

describe("createLinkedBranch", () => {
    const repo = new BranchRepository();

    beforeEach(() => {
        mockGraphql.mockReset();
    });

    it("escapes double quote in ref when baseBranchName contains quote", async () => {
        mockGraphql
            .mockResolvedValueOnce({
                repository: {
                    id: "R_1",
                    issue: { id: "I_1" },
                    ref: { target: { oid: "abc123" } },
                },
            })
            .mockResolvedValueOnce({ createLinkedBranch: { linkedBranch: { id: "LB_1" } } });

        await repo.createLinkedBranch(
            "o",
            "r",
            'feature"injection',
            "feature/42-foo",
            42,
            undefined,
            "token"
        );

        expect(mockGraphql).toHaveBeenCalledTimes(2);
        const queryString = mockGraphql.mock.calls[0][0] as string;
        expect(queryString).toContain('refs/heads/feature\\"injection');
        expect(queryString).not.toMatch(/qualifiedName:\s*"refs\/heads\/feature"[^\\]/);
    });

    it("escapes backslash in ref when baseBranchName contains backslash", async () => {
        mockGraphql
            .mockResolvedValueOnce({
                repository: {
                    id: "R_1",
                    issue: { id: "I_1" },
                    ref: { target: { oid: "abc123" } },
                },
            })
            .mockResolvedValueOnce({ createLinkedBranch: { linkedBranch: { id: "LB_1" } } });

        await repo.createLinkedBranch(
            "o",
            "r",
            "feature\\branch",
            "feature/42-foo",
            42,
            undefined,
            "token"
        );

        expect(mockGraphql).toHaveBeenCalledTimes(2);
        const queryString = mockGraphql.mock.calls[0][0] as string;
        expect(queryString).toContain("refs/heads/feature\\\\branch");
    });

    it("returns error result when repository id or oid is missing", async () => {
        mockGraphql.mockResolvedValueOnce({
            repository: {
                id: undefined,
                issue: { id: "I_1" },
                ref: { target: { oid: "abc" } },
            },
        });

        const result = await repo.createLinkedBranch(
            "o", "r", "develop", "feature/1-foo", 1, undefined, "token"
        );

        expect(result).toHaveLength(1);
        expect(result[0].success).toBe(false);
        expect(result[0].steps).toContainEqual(expect.stringContaining("Repository not found"));
        expect(mockGraphql).toHaveBeenCalledTimes(1);
    });

    it("returns error result when graphql throws", async () => {
        mockGraphql.mockRejectedValueOnce(new Error("GraphQL error"));

        const result = await repo.createLinkedBranch(
            "o", "r", "develop", "feature/1-foo", 1, undefined, "token"
        );

        expect(result).toHaveLength(1);
        expect(result[0].success).toBe(false);
        expect(result[0].steps).toContainEqual(expect.stringContaining("problem"));
    });
});
