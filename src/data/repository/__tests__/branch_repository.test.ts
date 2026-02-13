/**
 * Unit tests for BranchRepository: getListOfBranches, removeBranch, manageBranches.
 */

import { Execution } from '../../model/execution';
import { BranchRepository } from '../branch_repository';

jest.mock('../../../utils/logger', () => ({
    logDebugInfo: jest.fn(),
    logError: jest.fn(),
}));

const mockListBranches = jest.fn();
const mockGetRef = jest.fn();
const mockDeleteRef = jest.fn();
const mockGraphql = jest.fn();

jest.mock('@actions/github', () => ({
    getOctokit: () => ({
        rest: {
            repos: {
                listBranches: (...args: unknown[]) => mockListBranches(...args),
            },
            git: {
                getRef: (...args: unknown[]) => mockGetRef(...args),
                deleteRef: (...args: unknown[]) => mockDeleteRef(...args),
            },
        },
        graphql: (...args: unknown[]) => mockGraphql(...args),
    }),
}));

function mockExecution(overrides: Partial<Execution> = {}): Execution {
    const e = {
        branches: {
            featureTree: 'feature',
            bugfixTree: 'bugfix',
            docsTree: 'docs',
            choreTree: 'chore',
        },
        currentConfiguration: { parentBranch: undefined as string | undefined },
        ...overrides,
    };
    return e as unknown as Execution;
}

describe('BranchRepository', () => {
    const repo = new BranchRepository();

    beforeEach(() => {
        mockListBranches.mockReset();
        mockGetRef.mockReset();
        mockDeleteRef.mockReset();
        mockGraphql.mockReset();
    });

    describe('getListOfBranches', () => {
        it('returns branch names from single page', async () => {
            mockListBranches
                .mockResolvedValueOnce({ data: [{ name: 'main' }, { name: 'develop' }] })
                .mockResolvedValueOnce({ data: [] });

            const result = await repo.getListOfBranches('owner', 'repo', 'token');

            expect(result).toEqual(['main', 'develop']);
            expect(mockListBranches).toHaveBeenCalledWith({
                owner: 'owner',
                repo: 'repo',
                per_page: 100,
                page: 1,
            });
        });

        it('paginates until empty data', async () => {
            mockListBranches
                .mockResolvedValueOnce({ data: [{ name: 'a' }] })
                .mockResolvedValueOnce({ data: [{ name: 'b' }] })
                .mockResolvedValueOnce({ data: [] });

            const result = await repo.getListOfBranches('o', 'r', 't');

            expect(result).toEqual(['a', 'b']);
            expect(mockListBranches).toHaveBeenCalledTimes(3);
        });
    });

    describe('removeBranch', () => {
        it('deletes ref and returns true', async () => {
            mockGetRef.mockResolvedValue({ data: { ref: 'refs/heads/feature/1-foo' } });
            mockDeleteRef.mockResolvedValue({});

            const result = await repo.removeBranch('owner', 'repo', 'feature/1-foo', 'token');

            expect(result).toBe(true);
            expect(mockGetRef).toHaveBeenCalledWith({
                owner: 'owner',
                repo: 'repo',
                ref: 'heads/feature/1-foo',
            });
            expect(mockDeleteRef).toHaveBeenCalledWith({
                owner: 'owner',
                repo: 'repo',
                ref: 'heads/feature/1-foo',
            });
        });

        it('throws when getRef fails', async () => {
            mockGetRef.mockRejectedValue(new Error('Not found'));

            await expect(
                repo.removeBranch('o', 'r', 'branch', 't'),
            ).rejects.toThrow('Not found');
        });
    });

    describe('manageBranches', () => {
        it('returns error result when hotfixBranch is undefined and isHotfix is true', async () => {
            mockListBranches
                .mockResolvedValueOnce({ data: [] });
            const param = mockExecution();
            const result = await repo.manageBranches(
                param,
                'owner',
                'repo',
                1,
                'Title',
                'hotfix',
                'develop',
                undefined,
                true,
                'token',
            );

            expect(result).toHaveLength(1);
            expect(result[0].success).toBe(false);
            expect(result[0].executed).toBe(true);
            expect(result[0].steps).toContainEqual(
                expect.stringContaining('hotfix branch was not found'),
            );
        });

        it('returns success executed false when branch already exists', async () => {
            mockListBranches
                .mockResolvedValueOnce({ data: [{ name: 'feature/1-title' }, { name: 'develop' }] })
                .mockResolvedValueOnce({ data: [] });

            const param = mockExecution();
            const result = await repo.manageBranches(
                param,
                'owner',
                'repo',
                1,
                'Title',
                'feature',
                'develop',
                undefined,
                false,
                'token',
            );

            expect(result).toHaveLength(1);
            expect(result[0].success).toBe(true);
            expect(result[0].executed).toBe(false);
        });

        it('creates linked branch when branch does not exist', async () => {
            mockListBranches
                .mockResolvedValueOnce({ data: [{ name: 'develop' }] })
                .mockResolvedValueOnce({ data: [] })
                .mockResolvedValueOnce({ data: [] });
            mockGraphql
                .mockResolvedValueOnce({
                    repository: {
                        id: 'R_1',
                        issue: { id: 'I_1' },
                        ref: { target: { oid: 'abc123' } },
                    },
                })
                .mockResolvedValueOnce({
                    createLinkedBranch: { linkedBranch: { id: 'LB_1', ref: { name: 'feature/1-mytitle' } } },
                });

            const param = mockExecution();
            const result = await repo.manageBranches(
                param,
                'owner',
                'repo',
                1,
                'My Title',
                'feature',
                'develop',
                undefined,
                false,
                'token',
            );

            expect(result.length).toBeGreaterThanOrEqual(1);
            expect(result.some(r => r.success === true && r.executed === true)).toBe(true);
            expect(mockGraphql).toHaveBeenCalledTimes(2);
        });
    });
});
