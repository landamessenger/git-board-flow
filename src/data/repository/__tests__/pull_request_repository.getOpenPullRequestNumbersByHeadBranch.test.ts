/**
 * Unit tests for getOpenPullRequestNumbersByHeadBranch and updateDescription.
 */

import { PullRequestRepository } from '../pull_request_repository';

jest.mock('../../../utils/logger', () => ({
  logDebugInfo: jest.fn(),
  logError: jest.fn(),
}));

const mockPullsList = jest.fn();
const mockPullsUpdate = jest.fn();
jest.mock('@actions/github', () => ({
  getOctokit: () => ({
    rest: {
      pulls: {
        list: (...args: unknown[]) => mockPullsList(...args),
        update: (...args: unknown[]) => mockPullsUpdate(...args),
      },
    },
  }),
}));

describe('PullRequestRepository', () => {
  const repo = new PullRequestRepository();

  beforeEach(() => {
    mockPullsList.mockReset();
    mockPullsUpdate.mockReset();
  });

  describe('getOpenPullRequestNumbersByHeadBranch', () => {
    it('returns PR numbers for head branch', async () => {
      mockPullsList.mockResolvedValue({
        data: [
          { number: 10, head: { ref: 'feature/42-x' } },
          { number: 11, head: { ref: 'feature/42-x' } },
        ],
      });
      const result = await repo.getOpenPullRequestNumbersByHeadBranch(
        'owner',
        'repo',
        'feature/42-x',
        'token'
      );
      expect(result).toEqual([10, 11]);
      expect(mockPullsList).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        state: 'open',
        head: 'owner:feature/42-x',
      });
    });

    it('returns empty array when no PRs', async () => {
      mockPullsList.mockResolvedValue({ data: [] });
      const result = await repo.getOpenPullRequestNumbersByHeadBranch(
        'o',
        'r',
        'develop',
        'token'
      );
      expect(result).toEqual([]);
    });

    it('returns empty array when list throws', async () => {
      mockPullsList.mockRejectedValue(new Error('API error'));
      const result = await repo.getOpenPullRequestNumbersByHeadBranch(
        'o',
        'r',
        'branch',
        'token'
      );
      expect(result).toEqual([]);
    });
  });

  describe('updateDescription', () => {
    it('calls pulls.update with body', async () => {
      mockPullsUpdate.mockResolvedValue(undefined);
      await repo.updateDescription(
        'owner',
        'repo',
        5,
        '## Summary\nUpdated body',
        'token'
      );
      expect(mockPullsUpdate).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        pull_number: 5,
        body: '## Summary\nUpdated body',
      });
    });
  });
});
