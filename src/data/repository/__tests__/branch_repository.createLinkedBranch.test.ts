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
});
