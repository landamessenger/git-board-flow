/**
 * Unit tests for ProjectRepository: isActorAllowedToModifyFiles, getProjectDetail, getUserFromToken,
 * getTokenUserDetails, isContentLinked, linkContentId, getRandomMembers, getAllMembers,
 * createRelease, createTag, updateTag, updateRelease.
 */

import { ProjectRepository } from "../project_repository";
import { ProjectDetail } from "../../model/project_detail";

jest.mock("../../../utils/logger", () => ({
    logDebugInfo: jest.fn(),
    logError: jest.fn(),
    logInfo: jest.fn(),
}));

const mockGetByUsername = jest.fn();
const mockCheckMembershipForUser = jest.fn();
const mockGetAuthenticated = jest.fn();
const mockGraphql = jest.fn();
const mockTeamsList = jest.fn();
const mockListMembersInOrg = jest.fn();
const mockGetRef = jest.fn();
const mockCreateRef = jest.fn();
const mockUpdateRef = jest.fn();
const mockGetReleaseByTag = jest.fn();
const mockListReleases = jest.fn();
const mockUpdateRelease = jest.fn();
const mockCreateRelease = jest.fn();

const mockContext = { repo: { owner: "test-owner" } };
jest.mock("@actions/github", () => ({
    getOctokit: () => ({
        rest: {
            users: {
                getByUsername: (...args: unknown[]) => mockGetByUsername(...args),
                getAuthenticated: (...args: unknown[]) => mockGetAuthenticated(...args),
            },
            orgs: {
                checkMembershipForUser: (...args: unknown[]) =>
                    mockCheckMembershipForUser(...args),
            },
            teams: {
                list: (...args: unknown[]) => mockTeamsList(...args),
                listMembersInOrg: (...args: unknown[]) => mockListMembersInOrg(...args),
            },
            git: {
                getRef: (...args: unknown[]) => mockGetRef(...args),
                createRef: (...args: unknown[]) => mockCreateRef(...args),
                updateRef: (...args: unknown[]) => mockUpdateRef(...args),
            },
            repos: {
                getReleaseByTag: (...args: unknown[]) => mockGetReleaseByTag(...args),
                listReleases: (...args: unknown[]) => mockListReleases(...args),
                updateRelease: (...args: unknown[]) => mockUpdateRelease(...args),
                createRelease: (...args: unknown[]) => mockCreateRelease(...args),
            },
        },
        graphql: (...args: unknown[]) => mockGraphql(...args),
    }),
    get context() {
        return mockContext;
    },
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

    it("returns false when Organization and checkMembershipForUser throws non-404", async () => {
        mockGetByUsername.mockResolvedValue({
            data: { type: "Organization", login: "my-org" },
        });
        mockCheckMembershipForUser.mockRejectedValue(new Error("Forbidden"));

        const result = await repo.isActorAllowedToModifyFiles("my-org", "user", "token");

        expect(result).toBe(false);
    });
});

describe("ProjectRepository.getProjectDetail", () => {
    const repo = new ProjectRepository();

    beforeEach(() => {
        mockGetByUsername.mockReset();
        mockGraphql.mockReset();
        mockContext.repo = { owner: "test-owner" };
    });

    it("throws when projectId is not a number", async () => {
        await expect(repo.getProjectDetail("abc", "token")).rejects.toThrow("Invalid project ID");
        expect(mockGraphql).not.toHaveBeenCalled();
    });

    it("returns ProjectDetail when owner is User", async () => {
        mockGetByUsername.mockResolvedValue({ data: { type: "User", login: "test-owner" } });
        mockGraphql.mockResolvedValue({
            user: {
                projectV2: {
                    id: "PVT_1",
                    title: "My Project",
                    url: "https://github.com/users/test-owner/projects/1",
                },
            },
        });
        const result = await repo.getProjectDetail("1", "token");
        expect(result.id).toBe("PVT_1");
        expect(result.title).toBe("My Project");
        expect(result.type).toBe("user");
    });

    it("returns ProjectDetail when owner is Organization", async () => {
        mockGetByUsername.mockResolvedValue({ data: { type: "Organization", login: "test-owner" } });
        mockGraphql.mockResolvedValue({
            organization: {
                projectV2: {
                    id: "PVT_2",
                    title: "Org Project",
                    url: "https://github.com/orgs/test-owner/projects/2",
                },
            },
        });
        const result = await repo.getProjectDetail("2", "token");
        expect(result.id).toBe("PVT_2");
        expect(result.title).toBe("Org Project");
        expect(result.type).toBe("organization");
    });

    it("throws when project not found", async () => {
        mockGetByUsername.mockResolvedValue({ data: { type: "User", login: "test-owner" } });
        mockGraphql.mockResolvedValue({ user: { projectV2: null } });
        await expect(repo.getProjectDetail("99", "token")).rejects.toThrow("Project not found");
    });

    it("throws when getByUsername fails", async () => {
        mockGetByUsername.mockRejectedValue(new Error("Not found"));
        await expect(repo.getProjectDetail("1", "token")).rejects.toThrow("Failed to get owner");
    });
});

describe("ProjectRepository.getUserFromToken", () => {
    const repo = new ProjectRepository();

    beforeEach(() => {
        mockGetAuthenticated.mockReset();
    });

    it("returns user login", async () => {
        mockGetAuthenticated.mockResolvedValue({ data: { login: "octocat" } });
        const result = await repo.getUserFromToken("token");
        expect(result).toBe("octocat");
    });
});

describe("ProjectRepository.getTokenUserDetails", () => {
    const repo = new ProjectRepository();

    beforeEach(() => {
        mockGetAuthenticated.mockReset();
    });

    it("returns name and email from user", async () => {
        mockGetAuthenticated.mockResolvedValue({
            data: { login: "octocat", name: "Octo Cat", email: "octo@example.com" },
        });
        const result = await repo.getTokenUserDetails("token");
        expect(result).toEqual({ name: "Octo Cat", email: "octo@example.com" });
    });

    it("uses login and noreply email when name/email missing", async () => {
        mockGetAuthenticated.mockResolvedValue({
            data: { login: "bot", name: null, email: null },
        });
        const result = await repo.getTokenUserDetails("token");
        expect(result.name).toBe("bot");
        expect(result.email).toBe("bot@users.noreply.github.com");
    });
});

describe("ProjectRepository.isContentLinked", () => {
    const repo = new ProjectRepository();
    const project = new ProjectDetail({
        id: "PVT_1",
        title: "P",
        url: "https://example.com",
        type: "orgs",
        owner: "org",
        number: 1,
    });

    beforeEach(() => {
        mockGraphql.mockReset();
    });

    it("returns true when content is in project items", async () => {
        mockGraphql.mockResolvedValue({
            node: {
                items: {
                    nodes: [{ content: { id: "content-123" } }, { content: { id: "other" } }],
                    pageInfo: { hasNextPage: false, endCursor: null },
                },
            },
        });
        const result = await repo.isContentLinked(project, "content-123", "token");
        expect(result).toBe(true);
    });

    it("returns false when content is not in project items", async () => {
        mockGraphql.mockResolvedValue({
            node: {
                items: {
                    nodes: [{ content: { id: "other" } }],
                    pageInfo: { hasNextPage: false, endCursor: null },
                },
            },
        });
        const result = await repo.isContentLinked(project, "content-123", "token");
        expect(result).toBe(false);
    });
});

describe("ProjectRepository.linkContentId", () => {
    const repo = new ProjectRepository();
    const project = new ProjectDetail({
        id: "PVT_1",
        title: "P",
        url: "https://example.com",
        type: "orgs",
        owner: "org",
        number: 1,
    });

    beforeEach(() => {
        mockGraphql.mockReset();
    });

    it("returns false when content already linked", async () => {
        mockGraphql
            .mockResolvedValueOnce({
                node: {
                    items: {
                        nodes: [{ content: { id: "content-123" } }],
                        pageInfo: { hasNextPage: false, endCursor: null },
                    },
                },
            })
            .mockResolvedValueOnce({ addProjectV2ItemById: { item: { id: "item-1" } } });
        const result = await repo.linkContentId(project, "content-123", "token");
        expect(result).toBe(false);
    });

    it("returns true and links when content not linked", async () => {
        mockGraphql
            .mockResolvedValueOnce({
                node: {
                    items: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } },
                },
            })
            .mockResolvedValueOnce({ addProjectV2ItemById: { item: { id: "item-1" } } });
        const result = await repo.linkContentId(project, "content-123", "token");
        expect(result).toBe(true);
    });
});

describe("ProjectRepository.getRandomMembers", () => {
    const repo = new ProjectRepository();

    beforeEach(() => {
        mockTeamsList.mockReset();
        mockListMembersInOrg.mockReset();
    });

    it("returns empty array when membersToAdd is 0", async () => {
        const result = await repo.getRandomMembers("org", 0, [], "token");
        expect(result).toEqual([]);
        expect(mockTeamsList).not.toHaveBeenCalled();
    });

    it("returns empty array when org has no teams", async () => {
        mockTeamsList.mockResolvedValue({ data: [] });
        const result = await repo.getRandomMembers("org", 2, [], "token");
        expect(result).toEqual([]);
    });

    it("returns members not in currentMembers", async () => {
        mockTeamsList.mockResolvedValue({ data: [{ slug: "team-a" }] });
        mockListMembersInOrg.mockResolvedValue({
            data: [{ login: "alice" }, { login: "bob" }],
        });
        const result = await repo.getRandomMembers("org", 1, ["alice"], "token");
        expect(result).toHaveLength(1);
        expect(result[0]).toBe("bob");
    });
});

describe("ProjectRepository.getAllMembers", () => {
    const repo = new ProjectRepository();

    beforeEach(() => {
        mockTeamsList.mockReset();
        mockListMembersInOrg.mockReset();
    });

    it("returns empty array when org has no teams", async () => {
        mockTeamsList.mockResolvedValue({ data: [] });
        const result = await repo.getAllMembers("org", "token");
        expect(result).toEqual([]);
    });

    it("returns unique member logins from all teams", async () => {
        mockTeamsList.mockResolvedValue({ data: [{ slug: "t1" }, { slug: "t2" }] });
        mockListMembersInOrg
            .mockResolvedValueOnce({ data: [{ login: "a" }, { login: "b" }] })
            .mockResolvedValueOnce({ data: [{ login: "b" }, { login: "c" }] });
        const result = await repo.getAllMembers("org", "token");
        expect(result.sort()).toEqual(["a", "b", "c"]);
    });
});

describe("ProjectRepository.createRelease", () => {
    const repo = new ProjectRepository();

    beforeEach(() => {
        mockCreateRelease.mockReset();
    });

    it("returns release html_url on success", async () => {
        mockCreateRelease.mockResolvedValue({
            data: { html_url: "https://github.com/o/r/releases/tag/v1.0" },
        });
        const result = await repo.createRelease(
            "owner",
            "repo",
            "1.0",
            "First release",
            "Changelog",
            "token"
        );
        expect(result).toBe("https://github.com/o/r/releases/tag/v1.0");
        expect(mockCreateRelease).toHaveBeenCalledWith(
            expect.objectContaining({
                owner: "owner",
                repo: "repo",
                tag_name: "v1.0",
                name: "v1.0 - First release",
                body: "Changelog",
            })
        );
    });

    it("returns undefined when create fails", async () => {
        mockCreateRelease.mockRejectedValue(new Error("API error"));
        const result = await repo.createRelease("o", "r", "1.0", "Title", "Body", "token");
        expect(result).toBeUndefined();
    });
});

describe("ProjectRepository.createTag", () => {
    const repo = new ProjectRepository();

    beforeEach(() => {
        mockGetRef.mockReset();
        mockCreateRef.mockReset();
    });

    it("returns existing tag sha when tag already exists", async () => {
        mockGetRef.mockResolvedValue({
            data: { object: { sha: "abc123" } },
        });
        const result = await repo.createTag("owner", "repo", "main", "v1.0", "token");
        expect(result).toBe("abc123");
        expect(mockCreateRef).not.toHaveBeenCalled();
    });

    it("creates tag from branch and returns sha", async () => {
        mockGetRef
            .mockRejectedValueOnce(new Error("Not found"))
            .mockResolvedValueOnce({ data: { object: { sha: "branch-sha" } } });
        mockCreateRef.mockResolvedValue(undefined);
        const result = await repo.createTag("owner", "repo", "main", "v1.0", "token");
        expect(result).toBe("branch-sha");
        expect(mockCreateRef).toHaveBeenCalledWith(
            expect.objectContaining({
                owner: "owner",
                repo: "repo",
                ref: "refs/tags/v1.0",
                sha: "branch-sha",
            })
        );
    });

    it("returns undefined when branch ref fails", async () => {
        mockGetRef.mockRejectedValue(new Error("Not found"));
        const result = await repo.createTag("owner", "repo", "main", "v1.0", "token");
        expect(result).toBeUndefined();
    });
});

describe("ProjectRepository.updateTag", () => {
    const repo = new ProjectRepository();

    beforeEach(() => {
        mockGetRef.mockReset();
        mockCreateRef.mockReset();
        mockUpdateRef.mockReset();
    });

    it("updates existing target tag to point to source", async () => {
        mockGetRef
            .mockResolvedValueOnce({ data: { object: { sha: "source-sha" } } })
            .mockResolvedValueOnce({ data: { object: { sha: "old-target-sha" } } });
        mockUpdateRef.mockResolvedValue(undefined);
        await repo.updateTag("owner", "repo", "v1.0", "latest", "token");
        expect(mockUpdateRef).toHaveBeenCalledWith(
            expect.objectContaining({
                owner: "owner",
                repo: "repo",
                ref: "tags/latest",
                sha: "source-sha",
                force: true,
            })
        );
    });

    it("creates target ref when target tag does not exist", async () => {
        mockGetRef
            .mockResolvedValueOnce({ data: { object: { sha: "source-sha" } } })
            .mockRejectedValueOnce(new Error("Not found"));
        mockCreateRef.mockResolvedValue(undefined);
        await repo.updateTag("owner", "repo", "v1.0", "latest", "token");
        expect(mockCreateRef).toHaveBeenCalledWith(
            expect.objectContaining({
                ref: "refs/tags/latest",
                sha: "source-sha",
            })
        );
    });
});

describe("ProjectRepository.updateRelease", () => {
    const repo = new ProjectRepository();

    beforeEach(() => {
        mockGetReleaseByTag.mockReset();
        mockListReleases.mockReset();
        mockUpdateRelease.mockReset();
        mockCreateRelease.mockReset();
    });

    it("updates existing release when target exists", async () => {
        mockGetReleaseByTag.mockResolvedValue({
            data: {
                name: "v1.0",
                body: "Changelog",
                draft: false,
                prerelease: false,
            },
        });
        mockListReleases.mockResolvedValue({
            data: [{ tag_name: "latest", id: 42 }],
        });
        mockUpdateRelease.mockResolvedValue({ data: { id: 42 } });
        const result = await repo.updateRelease("owner", "repo", "v1.0", "latest", "token");
        expect(result).toBe("42");
        expect(mockUpdateRelease).toHaveBeenCalledWith(
            expect.objectContaining({
                owner: "owner",
                repo: "repo",
                release_id: 42,
                name: "v1.0",
                body: "Changelog",
            })
        );
    });

    it("creates new release when target tag has no release", async () => {
        mockGetReleaseByTag.mockResolvedValue({
            data: {
                name: "v1.0",
                body: "Changelog",
                draft: false,
                prerelease: false,
            },
        });
        mockListReleases.mockResolvedValue({ data: [] });
        mockCreateRelease.mockResolvedValue({ data: { id: 100 } });
        const result = await repo.updateRelease("owner", "repo", "v1.0", "latest", "token");
        expect(result).toBe("100");
        expect(mockCreateRelease).toHaveBeenCalledWith(
            expect.objectContaining({
                tag_name: "latest",
                name: "v1.0",
                body: "Changelog",
            })
        );
    });
});
