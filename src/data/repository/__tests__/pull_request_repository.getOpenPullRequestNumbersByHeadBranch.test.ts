/**
 * Unit tests for PullRequestRepository: getOpenPullRequestNumbersByHeadBranch, updateDescription,
 * updateBaseBranch, getCurrentReviewers, addReviewersToPullRequest, getChangedFiles,
 * getFilesWithFirstDiffLine, getPullRequestChanges, getPullRequestHeadSha,
 * listPullRequestReviewComments, getPullRequestReviewCommentBody, updatePullRequestReviewComment,
 * createReviewWithComments, isLinked.
 */

import { PullRequestRepository } from '../pull_request_repository';

jest.mock('../../../utils/logger', () => ({
  logDebugInfo: jest.fn(),
  logError: jest.fn(),
}));

const mockPullsList = jest.fn();
const mockPullsUpdate = jest.fn();
const mockPullsGet = jest.fn();
const mockListRequestedReviewers = jest.fn();
const mockListReviews = jest.fn();
const mockRequestReviewers = jest.fn();
const mockListFiles = jest.fn();
const mockListReviewComments = jest.fn();
const mockGetReviewComment = jest.fn();
const mockUpdateReviewComment = jest.fn();
const mockCreateReviewComment = jest.fn();
const mockPaginateIterator = jest.fn();

jest.mock('@actions/github', () => ({
  getOctokit: () => ({
    rest: {
      pulls: {
        list: (...args: unknown[]) => mockPullsList(...args),
        update: (...args: unknown[]) => mockPullsUpdate(...args),
        get: (...args: unknown[]) => mockPullsGet(...args),
        listRequestedReviewers: (...args: unknown[]) => mockListRequestedReviewers(...args),
        listReviews: (...args: unknown[]) => mockListReviews(...args),
        requestReviewers: (...args: unknown[]) => mockRequestReviewers(...args),
        listFiles: (...args: unknown[]) => mockListFiles(...args),
        listReviewComments: (...args: unknown[]) => mockListReviewComments(...args),
        getReviewComment: (...args: unknown[]) => mockGetReviewComment(...args),
        updateReviewComment: (...args: unknown[]) => mockUpdateReviewComment(...args),
        createReviewComment: (...args: unknown[]) => mockCreateReviewComment(...args),
      },
    },
    paginate: {
      iterator: (...args: unknown[]) => mockPaginateIterator(...args),
    },
  }),
}));

describe('PullRequestRepository', () => {
  const repo = new PullRequestRepository();

  beforeEach(() => {
    mockPullsList.mockReset();
    mockPullsUpdate.mockReset();
    mockPullsGet.mockReset();
    mockListRequestedReviewers.mockReset();
    mockListReviews.mockReset();
    mockRequestReviewers.mockReset();
    mockListFiles.mockReset();
    mockListReviewComments.mockReset();
    mockGetReviewComment.mockReset();
    mockUpdateReviewComment.mockReset();
    mockCreateReviewComment.mockReset();
    mockPaginateIterator.mockReset();
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

  describe('updateBaseBranch', () => {
    it('calls pulls.update with base branch', async () => {
      mockPullsUpdate.mockResolvedValue(undefined);
      await repo.updateBaseBranch('owner', 'repo', 5, 'main', 'token');
      expect(mockPullsUpdate).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        pull_number: 5,
        base: 'main',
      });
    });
  });

  describe('getCurrentReviewers', () => {
    it('returns union of requested and review authors', async () => {
      mockListRequestedReviewers.mockResolvedValue({
        data: { users: [{ login: 'alice' }] },
      });
      mockListReviews.mockResolvedValue({
        data: [{ user: { login: 'bob' } }],
      });
      const result = await repo.getCurrentReviewers('o', 'r', 1, 'token');
      expect(result.sort()).toEqual(['alice', 'bob']);
    });

    it('returns empty array when API throws', async () => {
      mockListRequestedReviewers.mockRejectedValue(new Error('API error'));
      const result = await repo.getCurrentReviewers('o', 'r', 1, 'token');
      expect(result).toEqual([]);
    });
  });

  describe('addReviewersToPullRequest', () => {
    it('requests reviewers and returns their logins', async () => {
      mockRequestReviewers.mockResolvedValue({
        data: { requested_reviewers: [{ login: 'alice' }, { login: 'bob' }] },
      });
      const result = await repo.addReviewersToPullRequest('o', 'r', 1, ['alice', 'bob'], 'token');
      expect(result).toEqual(['alice', 'bob']);
      expect(mockRequestReviewers).toHaveBeenCalledWith({
        owner: 'o',
        repo: 'r',
        pull_number: 1,
        reviewers: ['alice', 'bob'],
      });
    });

    it('returns empty array when reviewers empty', async () => {
      const result = await repo.addReviewersToPullRequest('o', 'r', 1, [], 'token');
      expect(result).toEqual([]);
      expect(mockRequestReviewers).not.toHaveBeenCalled();
    });

    it('returns empty array when API throws', async () => {
      mockRequestReviewers.mockRejectedValue(new Error('API error'));
      const result = await repo.addReviewersToPullRequest('o', 'r', 1, ['x'], 'token');
      expect(result).toEqual([]);
    });
  });

  describe('getChangedFiles', () => {
    it('returns filename and status from paginated listFiles', async () => {
      const asyncIter = (async function* () {
        yield { data: [{ filename: 'a.ts', status: 'modified' }] };
        yield { data: [{ filename: 'b.ts', status: 'added' }] };
      })();
      mockPaginateIterator.mockReturnValue(asyncIter);
      const result = await repo.getChangedFiles('o', 'r', 1, 'token');
      expect(result).toEqual([
        { filename: 'a.ts', status: 'modified' },
        { filename: 'b.ts', status: 'added' },
      ]);
    });

    it('returns empty array when listFiles throws', async () => {
      mockPaginateIterator.mockImplementation(() => {
        throw new Error('API error');
      });
      const result = await repo.getChangedFiles('o', 'r', 1, 'token');
      expect(result).toEqual([]);
    });
  });

  describe('getFilesWithFirstDiffLine', () => {
    it('returns path and first line from patch (excludes removed and empty patch)', async () => {
      mockListFiles.mockResolvedValue({
        data: [
          { filename: 'a.ts', status: 'modified', patch: '@@ -1,3 +5,2 @@\n context' },
          { filename: 'b.ts', status: 'removed', patch: null },
          { filename: 'c.ts', status: 'added', patch: '@@ -0,0 +1,1 @@\n+line' },
        ],
      });
      const result = await repo.getFilesWithFirstDiffLine('o', 'r', 1, 'token');
      expect(result).toEqual([
        { path: 'a.ts', firstLine: 5 },
        { path: 'c.ts', firstLine: 1 },
      ]);
    });

    it('returns empty array when listFiles throws', async () => {
      mockListFiles.mockRejectedValue(new Error('API error'));
      const result = await repo.getFilesWithFirstDiffLine('o', 'r', 1, 'token');
      expect(result).toEqual([]);
    });
  });

  describe('getPullRequestChanges', () => {
    it('returns files with additions, deletions, patch', async () => {
      const asyncIter = (async function* () {
        yield {
          data: [
            {
              filename: 'x.ts',
              status: 'modified',
              additions: 2,
              deletions: 1,
              patch: '+line',
            },
          ],
        };
      })();
      mockPaginateIterator.mockReturnValue(asyncIter);
      const result = await repo.getPullRequestChanges('o', 'r', 1, 'token');
      expect(result).toEqual([
        {
          filename: 'x.ts',
          status: 'modified',
          additions: 2,
          deletions: 1,
          patch: '+line',
        },
      ]);
    });

    it('returns empty array when API throws', async () => {
      mockPaginateIterator.mockImplementation(() => {
        throw new Error('API error');
      });
      const result = await repo.getPullRequestChanges('o', 'r', 1, 'token');
      expect(result).toEqual([]);
    });
  });

  describe('getPullRequestHeadSha', () => {
    it('returns head sha', async () => {
      mockPullsGet.mockResolvedValue({ data: { head: { sha: 'abc123' } } });
      const result = await repo.getPullRequestHeadSha('o', 'r', 1, 'token');
      expect(result).toBe('abc123');
    });

    it('returns undefined when get throws', async () => {
      mockPullsGet.mockRejectedValue(new Error('API error'));
      const result = await repo.getPullRequestHeadSha('o', 'r', 1, 'token');
      expect(result).toBeUndefined();
    });
  });

  describe('listPullRequestReviewComments', () => {
    it('returns comments from paginated iterator', async () => {
      const asyncIter = (async function* () {
        yield {
          data: [
            { id: 1, body: 'c1', path: 'a.ts', line: 10, node_id: 'N1' },
            { id: 2, body: null, path: undefined, line: null, node_id: undefined },
          ],
        };
      })();
      mockPaginateIterator.mockReturnValue(asyncIter);
      const result = await repo.listPullRequestReviewComments('o', 'r', 1, 'token');
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 1,
        body: 'c1',
        path: 'a.ts',
        line: 10,
        node_id: 'N1',
      });
      expect(result[1].body).toBeNull();
    });

    it('returns empty array when API throws', async () => {
      mockPaginateIterator.mockImplementation(() => {
        throw new Error('API error');
      });
      const result = await repo.listPullRequestReviewComments('o', 'r', 1, 'token');
      expect(result).toEqual([]);
    });
  });

  describe('getPullRequestReviewCommentBody', () => {
    it('returns comment body', async () => {
      mockGetReviewComment.mockResolvedValue({ data: { body: 'Comment text' } });
      const result = await repo.getPullRequestReviewCommentBody(
        'o',
        'r',
        1,
        100,
        'token'
      );
      expect(result).toBe('Comment text');
      expect(mockGetReviewComment).toHaveBeenCalledWith({
        owner: 'o',
        repo: 'r',
        comment_id: 100,
      });
    });

    it('returns null when comment not found', async () => {
      mockGetReviewComment.mockRejectedValue(new Error('404'));
      const result = await repo.getPullRequestReviewCommentBody(
        'o',
        'r',
        1,
        100,
        'token'
      );
      expect(result).toBeNull();
    });
  });

  describe('updatePullRequestReviewComment', () => {
    it('calls pulls.updateReviewComment', async () => {
      mockUpdateReviewComment.mockResolvedValue(undefined);
      await repo.updatePullRequestReviewComment('o', 'r', 100, 'New body', 'token');
      expect(mockUpdateReviewComment).toHaveBeenCalledWith({
        owner: 'o',
        repo: 'r',
        comment_id: 100,
        body: 'New body',
      });
    });
  });

  describe('createReviewWithComments', () => {
    it('creates review comments and does not throw', async () => {
      mockCreateReviewComment.mockResolvedValue({ data: { id: 1 } });
      await repo.createReviewWithComments(
        'o',
        'r',
        1,
        'commit-sha',
        [{ path: 'a.ts', line: 1, body: 'Comment' }],
        'token'
      );
      expect(mockCreateReviewComment).toHaveBeenCalledWith({
        owner: 'o',
        repo: 'r',
        pull_number: 1,
        commit_id: 'commit-sha',
        path: 'a.ts',
        line: 1,
        side: 'RIGHT',
        body: 'Comment',
      });
    });

    it('does nothing when comments empty', async () => {
      await repo.createReviewWithComments('o', 'r', 1, 'sha', [], 'token');
      expect(mockCreateReviewComment).not.toHaveBeenCalled();
    });
  });

  describe('isLinked', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('returns true when page does not contain has_github_issues=false', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: async () => '<html>Linked project</html>',
      });
      const result = await repo.isLinked('https://github.com/o/r/pull/1');
      expect(result).toBe(true);
    });

    it('returns false when page contains has_github_issues=false', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: async () => 'has_github_issues=false',
      });
      const result = await repo.isLinked('https://github.com/o/r/pull/1');
      expect(result).toBe(false);
    });

    it('returns false when response is not ok', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 });
      const result = await repo.isLinked('https://github.com/o/r/pull/1');
      expect(result).toBe(false);
    });

    it('returns false when fetch throws', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
      const result = await repo.isLinked('https://github.com/o/r/pull/1');
      expect(result).toBe(false);
    });
  });
});
