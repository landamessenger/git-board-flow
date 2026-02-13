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
const mockChecksListForRef = jest.fn();
const mockReposGetCombinedStatusForRef = jest.fn();

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
                getCombinedStatusForRef: (...args: unknown[]) => mockReposGetCombinedStatusForRef(...args),
            },
            checks: {
                listForRef: (...args: unknown[]) => mockChecksListForRef(...args),
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
        mockChecksListForRef.mockReset();
        mockReposGetCombinedStatusForRef.mockReset();
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

    it('when timeout > 10 waits for check runs (all completed) then merges', async () => {
        mockPullsCreate.mockResolvedValue({ data: { number: 1 } });
        mockPullsListCommits.mockResolvedValue({ data: [{ commit: { message: 'msg' } }] });
        mockPullsUpdate.mockResolvedValue({});
        mockPullsMerge.mockResolvedValue({});
        mockChecksListForRef.mockResolvedValue({
            data: {
                check_runs: [
                    { name: 'ci', status: 'completed', conclusion: 'success' },
                ],
            },
        });
        mockReposGetCombinedStatusForRef.mockResolvedValue({
            data: { state: 'success', statuses: [] },
        });

        const result = await repo.mergeBranch(
            'owner',
            'repo',
            'feature/1-x',
            'develop',
            30,
            'token',
        );

        expect(result).toHaveLength(1);
        expect(result[0].success).toBe(true);
        expect(mockChecksListForRef).toHaveBeenCalledWith({
            owner: 'owner',
            repo: 'repo',
            ref: 'feature/1-x',
        });
        expect(mockPullsMerge).toHaveBeenCalled();
    });

    it('when timeout > 10 and check runs have failure throws then direct merge fallback fails', async () => {
        mockPullsCreate.mockResolvedValue({ data: { number: 1 } });
        mockPullsListCommits.mockResolvedValue({ data: [] });
        mockPullsUpdate.mockResolvedValue({});
        mockChecksListForRef.mockResolvedValue({
            data: {
                check_runs: [
                    { name: 'ci', status: 'completed', conclusion: 'failure' },
                ],
            },
        });
        mockReposGetCombinedStatusForRef.mockResolvedValue({
            data: { state: 'success', statuses: [] },
        });
        mockReposMerge.mockRejectedValue(new Error('Direct merge failed'));

        const result = await repo.mergeBranch('o', 'r', 'head', 'base', 30, 'token');

        expect(result.some(r => r.success === false && r.steps?.some(s => s.includes('Failed to merge')))).toBe(true);
    });

    it('when timeout > 10 and no check runs uses status checks (all completed)', async () => {
        mockPullsCreate.mockResolvedValue({ data: { number: 1 } });
        mockPullsListCommits.mockResolvedValue({ data: [] });
        mockPullsUpdate.mockResolvedValue({});
        mockChecksListForRef.mockResolvedValue({
            data: { check_runs: [] },
        });
        mockReposGetCombinedStatusForRef.mockResolvedValue({
            data: { state: 'success', statuses: [{ context: 'ci', state: 'success' }] },
        });
        mockPullsMerge.mockResolvedValue({});

        const result = await repo.mergeBranch(
            'o', 'r', 'head', 'base', 30, 'token',
        );

        expect(result).toHaveLength(1);
        expect(result[0].success).toBe(true);
        expect(mockReposGetCombinedStatusForRef).toHaveBeenCalled();
    });

    it('when timeout > 10 and checks never complete throws then direct merge succeeds', async () => {
        jest.useFakeTimers();
        mockPullsCreate.mockResolvedValue({ data: { number: 1 } });
        mockPullsListCommits.mockResolvedValue({ data: [] });
        mockPullsUpdate.mockResolvedValue({});
        mockChecksListForRef.mockResolvedValue({
            data: {
                check_runs: [{ name: 'ci', status: 'in_progress', conclusion: null }],
            },
        });
        mockReposGetCombinedStatusForRef.mockResolvedValue({
            data: { state: 'pending', statuses: [] },
        });
        mockReposMerge.mockResolvedValue({});

        const promise = repo.mergeBranch('o', 'r', 'head', 'base', 30, 'token');
        await jest.runAllTimersAsync();
        const result = await promise;

        jest.useRealTimers();
        expect(result.some(r => r.success === true && r.steps?.some(s => s.includes('direct merge')))).toBe(true);
    });
});
