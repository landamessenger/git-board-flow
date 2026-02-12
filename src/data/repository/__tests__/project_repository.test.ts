/**
 * Unit tests for ProjectRepository.isActorAllowedToModifyFiles: org member, user owner, 404/errors.
 */

import { ProjectRepository } from "../project_repository";

jest.mock("../../../utils/logger", () => ({
    logDebugInfo: jest.fn(),
    logError: jest.fn(),
}));

const mockGetByUsername = jest.fn();
const mockCheckMembershipForUser = jest.fn();

jest.mock("@actions/github", () => ({
    getOctokit: () => ({
        rest: {
            users: {
                getByUsername: (...args: unknown[]) => mockGetByUsername(...args),
            },
            orgs: {
                checkMembershipForUser: (...args: unknown[]) =>
                    mockCheckMembershipForUser(...args),
            },
        },
    }),
}));

describe("ProjectRepository.isActorAllowedToModifyFiles", () => {
    const repo = new ProjectRepository();

    beforeEach(() => {
        mockGetByUsername.mockReset();
        mockCheckMembershipForUser.mockReset();
    });

    it("returns true when owner is User and actor equals owner", async () => {
        mockGetByUsername.mockResolvedValue({
            data: { type: "User", login: "alice" },
        });

        const result = await repo.isActorAllowedToModifyFiles("alice", "alice", "token");

        expect(result).toBe(true);
        expect(mockCheckMembershipForUser).not.toHaveBeenCalled();
    });

    it("returns false when owner is User and actor differs", async () => {
        mockGetByUsername.mockResolvedValue({
            data: { type: "User", login: "alice" },
        });

        const result = await repo.isActorAllowedToModifyFiles("alice", "bob", "token");

        expect(result).toBe(false);
        expect(mockCheckMembershipForUser).not.toHaveBeenCalled();
    });

    it("returns true when owner is Organization and actor is member", async () => {
        mockGetByUsername.mockResolvedValue({
            data: { type: "Organization", login: "my-org" },
        });
        mockCheckMembershipForUser.mockResolvedValue({ status: 204 });

        const result = await repo.isActorAllowedToModifyFiles("my-org", "bob", "token");

        expect(result).toBe(true);
        expect(mockCheckMembershipForUser).toHaveBeenCalledWith({
            org: "my-org",
            username: "bob",
        });
    });

    it("returns false when owner is Organization and actor is not member (404)", async () => {
        mockGetByUsername.mockResolvedValue({
            data: { type: "Organization", login: "my-org" },
        });
        mockCheckMembershipForUser.mockRejectedValue({ status: 404 });

        const result = await repo.isActorAllowedToModifyFiles("my-org", "outsider", "token");

        expect(result).toBe(false);
    });

    it("returns false when getByUsername throws", async () => {
        mockGetByUsername.mockRejectedValue(new Error("Network error"));

        const result = await repo.isActorAllowedToModifyFiles("org", "actor", "token");

        expect(result).toBe(false);
    });
});
