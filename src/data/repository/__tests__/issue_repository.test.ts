/**
 * Unit tests for IssueRepository: getDescription, addComment, getIssueDescription, isIssue, isPullRequest.
 */

import { IssueRepository, PROGRESS_LABEL_PATTERN } from '../issue_repository';

jest.mock('../../../utils/logger', () => ({
  logDebugInfo: jest.fn(),
  logError: jest.fn(),
}));

const mockRest = {
  issues: {
    get: jest.fn(),
    createComment: jest.fn(),
    updateComment: jest.fn(),
  },
  pulls: {
    get: jest.fn(),
  },
};

jest.mock('@actions/github', () => ({
  getOctokit: () => ({
    rest: mockRest,
  }),
}));

describe('IssueRepository', () => {
  const repo = new IssueRepository();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getDescription', () => {
    it('returns undefined when issueNumber is -1', async () => {
      const result = await repo.getDescription('o', 'r', -1, 'token');
      expect(result).toBeUndefined();
      expect(mockRest.issues.get).not.toHaveBeenCalled();
    });

    it('returns body when issue exists', async () => {
      mockRest.issues.get.mockResolvedValue({
        data: { body: 'Issue body text' },
      });
      const result = await repo.getDescription('owner', 'repo', 42, 'token');
      expect(result).toBe('Issue body text');
      expect(mockRest.issues.get).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        issue_number: 42,
      });
    });

    it('returns empty string when issue body is null', async () => {
      mockRest.issues.get.mockResolvedValue({ data: { body: null } });
      const result = await repo.getDescription('o', 'r', 1, 'token');
      expect(result).toBe('');
    });

    it('returns undefined when get throws', async () => {
      mockRest.issues.get.mockRejectedValue(new Error('Not found'));
      const result = await repo.getDescription('o', 'r', 1, 'token');
      expect(result).toBeUndefined();
    });
  });

  describe('addComment', () => {
    it('calls issues.createComment with owner, repo, issue_number, body', async () => {
      mockRest.issues.createComment.mockResolvedValue(undefined);
      await repo.addComment('owner', 'repo', 10, 'Hello comment', 'token');
      expect(mockRest.issues.createComment).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        issue_number: 10,
        body: 'Hello comment',
      });
    });
  });

  describe('getIssueDescription', () => {
    it('returns issue body', async () => {
      mockRest.issues.get.mockResolvedValue({
        data: { body: 'Full issue description' },
      });
      const result = await repo.getIssueDescription('o', 'r', 5, 'token');
      expect(result).toBe('Full issue description');
      expect(mockRest.issues.get).toHaveBeenCalledWith({
        owner: 'o',
        repo: 'r',
        issue_number: 5,
      });
    });

    it('returns empty string when body is null', async () => {
      mockRest.issues.get.mockResolvedValue({ data: { body: null } });
      const result = await repo.getIssueDescription('o', 'r', 1, 'token');
      expect(result).toBe('');
    });
  });

  describe('isPullRequest', () => {
    it('returns true when issue is a pull request', async () => {
      mockRest.issues.get.mockResolvedValue({
        data: { pull_request: {} },
      });
      const result = await repo.isPullRequest('o', 'r', 3, 'token');
      expect(result).toBe(true);
    });

    it('returns false when issue is not a pull request', async () => {
      mockRest.issues.get.mockResolvedValue({
        data: {},
      });
      const result = await repo.isPullRequest('o', 'r', 3, 'token');
      expect(result).toBe(false);
    });
  });

  describe('isIssue', () => {
    it('returns true when isPullRequest returns false', async () => {
      mockRest.issues.get.mockResolvedValue({ data: {} });
      const result = await repo.isIssue('o', 'r', 3, 'token');
      expect(result).toBe(true);
    });

    it('returns false when isPullRequest returns true', async () => {
      mockRest.issues.get.mockResolvedValue({ data: { pull_request: {} } });
      const result = await repo.isIssue('o', 'r', 3, 'token');
      expect(result).toBe(false);
    });
  });
});

describe('PROGRESS_LABEL_PATTERN', () => {
  it('matches percentage labels', () => {
    expect('0%').toMatch(PROGRESS_LABEL_PATTERN);
    expect('50%').toMatch(PROGRESS_LABEL_PATTERN);
    expect('100%').toMatch(PROGRESS_LABEL_PATTERN);
  });

  it('does not match non-percentage strings', () => {
    expect('feature').not.toMatch(PROGRESS_LABEL_PATTERN);
    expect('50').not.toMatch(PROGRESS_LABEL_PATTERN);
  });
});
