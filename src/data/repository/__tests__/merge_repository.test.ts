/**
 * Unit tests for MergeRepository: mergeBranch (PR merge and direct merge fallback).
 */

import { MergeRepository } from '../merge_repository';

jest.mock('../../../utils/logger', () => ({
    logDebugInfo: jest.fn(),
    logError: jest.fn(),
}));

const mockPullsCreate = jest.fn();
const mockPullsListCommits = jest.fn();
const mockPullsUpdate = jest.fn();
const mockPullsMerge = jest.fn();
const mockReposMerge = jest.fn();

jest.mock('@actions/github', () => ({
    getOctokit: () => ({
        rest: {
            pulls: {
                create: (...args: unknown[]) => mockPullsCreate(...args),
                listCommits: (...args: unknown[]) => mockPullsListCommits(...args),
                update: (...args: unknown[]) => mockPullsUpdate(...args),
                merge: (...args: unknown[]) => mockPullsMerge(...args),
            },
            repos: {
                merge: (...args: unknown[]) => mockReposMerge(...args),
            },
        },
    }),
}));

describe('MergeRepository', () => {
    const repo = new MergeRepository();

    beforeEach(() => {
        mockPullsCreate.mockReset();
        mockPullsListCommits.mockReset();
        mockPullsUpdate.mockReset();
        mockPullsMerge.mockReset();
        mockReposMerge.mockReset();
    });

    it('creates PR, updates body, merges and returns success (timeout <= 10 skips wait)', async () => {
        mockPullsCreate.mockResolvedValue({
            data: { number: 42 },
        });
        mockPullsListCommits.mockResolvedValue({
            data: [{ commit: { message: 'fix: thing' } }],
        });
        mockPullsUpdate.mockResolvedValue({});
        mockPullsMerge.mockResolvedValue({});

        const result = await repo.mergeBranch(
            'owner',
            'repo',
            'feature/1-foo',
            'develop',
            5,
            'token',
        );

        expect(result).toHaveLength(1);
        expect(result[0].success).toBe(true);
        expect(result[0].steps).toContainEqual(expect.stringContaining('was merged into'));
        expect(mockPullsCreate).toHaveBeenCalledWith({
            owner: 'owner',
            repo: 'repo',
            head: 'feature/1-foo',
            base: 'develop',
            title: expect.any(String),
            body: expect.any(String),
        });
        expect(mockPullsListCommits).toHaveBeenCalledWith({
            owner: 'owner',
            repo: 'repo',
            pull_number: 42,
        });
        expect(mockPullsMerge).toHaveBeenCalledWith({
            owner: 'owner',
            repo: 'repo',
            pull_number: 42,
            merge_method: 'merge',
            commit_title: expect.any(String),
        });
    });

    it('on PR create failure falls back to direct merge and returns success', async () => {
        mockPullsCreate.mockRejectedValue(new Error('PR create failed'));
        mockReposMerge.mockResolvedValue({});

        const result = await repo.mergeBranch(
            'o',
            'r',
            'head',
            'base',
            0,
            'token',
        );

        expect(result).toHaveLength(1);
        expect(result[0].success).toBe(true);
        expect(result[0].steps).toContainEqual(expect.stringContaining('using direct merge'));
        expect(mockReposMerge).toHaveBeenCalledWith({
            owner: 'o',
            repo: 'r',
            base: 'base',
            head: 'head',
            commit_message: expect.any(String),
        });
    });

    it('on PR failure and direct merge failure returns multiple error results', async () => {
        mockPullsCreate.mockRejectedValue(new Error('PR failed'));
        mockReposMerge.mockRejectedValue(new Error('Direct merge failed'));

        const result = await repo.mergeBranch(
            'o',
            'r',
            'head',
            'base',
            0,
            'token',
        );

        expect(result.length).toBeGreaterThanOrEqual(2);
        expect(result.some(r => r.success === false && r.steps?.some(s => s.includes('Failed to merge')))).toBe(true);
        expect(result.length).toBeGreaterThanOrEqual(2);
    });
});
