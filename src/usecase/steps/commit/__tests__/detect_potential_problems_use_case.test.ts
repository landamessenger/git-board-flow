/**
 * Unit tests for DetectPotentialProblemsUseCase (bugbot on push).
 * Covers: skip when OpenCode/issue missing, prompt with/without previous findings,
 * new findings (add/update issue and PR comments), resolved_finding_ids, errors.
 */

import { DetectPotentialProblemsUseCase } from '../detect_potential_problems_use_case';
import { Ai } from '../../../../data/model/ai';
import type { Execution } from '../../../../data/model/execution';

jest.mock('../../../../utils/logger', () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
  logDebugInfo: jest.fn(),
}));

const mockListIssueComments = jest.fn();
const mockAddComment = jest.fn();
const mockUpdateComment = jest.fn();
jest.mock('../../../../data/repository/issue_repository', () => ({
  IssueRepository: jest.fn().mockImplementation(() => ({
    listIssueComments: mockListIssueComments,
    addComment: mockAddComment,
    updateComment: mockUpdateComment,
  })),
}));

const mockGetOpenPullRequestNumbersByHeadBranch = jest.fn();
const mockListPullRequestReviewComments = jest.fn();
const mockGetPullRequestHeadSha = jest.fn();
const mockGetChangedFiles = jest.fn();
const mockCreateReviewWithComments = jest.fn();
const mockUpdatePullRequestReviewComment = jest.fn();
jest.mock('../../../../data/repository/pull_request_repository', () => ({
  PullRequestRepository: jest.fn().mockImplementation(() => ({
    getOpenPullRequestNumbersByHeadBranch: mockGetOpenPullRequestNumbersByHeadBranch,
    listPullRequestReviewComments: mockListPullRequestReviewComments,
    getPullRequestHeadSha: mockGetPullRequestHeadSha,
    getChangedFiles: mockGetChangedFiles,
    createReviewWithComments: mockCreateReviewWithComments,
    updatePullRequestReviewComment: mockUpdatePullRequestReviewComment,
  })),
}));

const mockAskAgent = jest.fn();
jest.mock('../../../../data/repository/ai_repository', () => ({
  AiRepository: jest.fn().mockImplementation(() => ({
    askAgent: mockAskAgent,
  })),
  OPENCODE_AGENT_PLAN: 'plan',
}));

function baseParam(overrides: Record<string, unknown> = {}): Execution {
  return {
    owner: 'owner',
    repo: 'repo',
    issueNumber: 42,
    tokens: { token: 'token' },
    commit: { branch: 'feature/42-add-feature' },
    currentConfiguration: { parentBranch: 'develop' },
    branches: { development: 'develop' },
    ai: new Ai('http://localhost:4096', 'opencode/model', false, false, [], false),
    ...overrides,
  } as unknown as Execution;
}

describe('DetectPotentialProblemsUseCase', () => {
  let useCase: DetectPotentialProblemsUseCase;

  beforeEach(() => {
    useCase = new DetectPotentialProblemsUseCase();
    mockListIssueComments.mockReset();
    mockAddComment.mockReset();
    mockUpdateComment.mockReset();
    mockGetOpenPullRequestNumbersByHeadBranch.mockReset();
    mockListPullRequestReviewComments.mockReset();
    mockGetPullRequestHeadSha.mockReset();
    mockGetChangedFiles.mockReset();
    mockCreateReviewWithComments.mockReset();
    mockUpdatePullRequestReviewComment.mockReset();
    mockAskAgent.mockReset();

    mockListIssueComments.mockResolvedValue([]);
    mockGetOpenPullRequestNumbersByHeadBranch.mockResolvedValue([]);
  });

  it('returns empty results when OpenCode is not configured (no server URL)', async () => {
    const param = baseParam({
      ai: new Ai('', 'opencode/model', false, false, [], false),
    });

    const results = await useCase.invoke(param);

    expect(results).toHaveLength(0);
    expect(mockListIssueComments).not.toHaveBeenCalled();
    expect(mockAskAgent).not.toHaveBeenCalled();
  });

  it('returns empty results when OpenCode is not configured (no model)', async () => {
    const param = baseParam({
      ai: new Ai('http://localhost:4096', '', false, false, [], false),
    });

    const results = await useCase.invoke(param);

    expect(results).toHaveLength(0);
    expect(mockAskAgent).not.toHaveBeenCalled();
  });

  it('returns empty results when ai is undefined', async () => {
    const param = baseParam({ ai: undefined });

    const results = await useCase.invoke(param);

    expect(results).toHaveLength(0);
    expect(mockAskAgent).not.toHaveBeenCalled();
  });

  it('returns empty results when issue number is -1', async () => {
    const param = baseParam({ issueNumber: -1 });

    const results = await useCase.invoke(param);

    expect(results).toHaveLength(0);
    expect(mockListIssueComments).not.toHaveBeenCalled();
    expect(mockAskAgent).not.toHaveBeenCalled();
  });

  it('returns empty results when askAgent returns null', async () => {
    mockAskAgent.mockResolvedValue(null);

    const results = await useCase.invoke(baseParam());

    expect(results).toHaveLength(0);
    expect(mockAskAgent).toHaveBeenCalledTimes(1);
    expect(mockAddComment).not.toHaveBeenCalled();
  });

  it('returns empty results when askAgent returns a string (non-object)', async () => {
    mockAskAgent.mockResolvedValue('plain text');

    const results = await useCase.invoke(baseParam());

    expect(results).toHaveLength(0);
    expect(mockAddComment).not.toHaveBeenCalled();
  });

  it('returns success with no-new-findings when response has no findings array', async () => {
    mockAskAgent.mockResolvedValue({ other: 'data' });

    const results = await useCase.invoke(baseParam());

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);
    expect(results[0].steps?.[0]).toContain('no new findings, no resolved');
    expect(mockAddComment).not.toHaveBeenCalled();
  });

  it('returns success with "no new findings, no resolved" when findings and resolved_finding_ids are empty', async () => {
    mockAskAgent.mockResolvedValue({ findings: [], resolved_finding_ids: [] });

    const results = await useCase.invoke(baseParam());

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);
    expect(results[0].executed).toBe(true);
    expect(results[0].steps?.[0]).toContain('no new findings, no resolved');
    expect(mockAddComment).not.toHaveBeenCalled();
    expect(mockUpdateComment).not.toHaveBeenCalled();
  });

  it('calls listIssueComments and askAgent with repo context and no previous block when no comments', async () => {
    mockAskAgent.mockResolvedValue({ findings: [], resolved_finding_ids: [] });

    await useCase.invoke(baseParam());

    expect(mockListIssueComments).toHaveBeenCalledWith('owner', 'repo', 42, 'token');
    expect(mockAskAgent).toHaveBeenCalledTimes(1);
    const prompt = mockAskAgent.mock.calls[0][2];
    expect(prompt).toContain('Owner: owner');
    expect(prompt).toContain('Repository: repo');
    expect(prompt).toContain('feature/42-add-feature');
    expect(prompt).toContain('develop');
    expect(prompt).not.toContain('Previously reported issues');
  });

  it('when OpenCode returns one finding, adds comment on issue and does not update', async () => {
    const finding = {
      id: 'src/foo.ts:10:possible-null',
      title: 'Possible null dereference',
      description: 'Variable x may be null here.',
    };
    mockAskAgent.mockResolvedValue({ findings: [finding] });

    const results = await useCase.invoke(baseParam());

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);
    expect(results[0].steps?.[0]).toContain('1 new/current finding(s)');
    expect(mockAddComment).toHaveBeenCalledTimes(1);
    expect(mockAddComment).toHaveBeenCalledWith('owner', 'repo', 42, expect.any(String), 'token');
    expect(mockAddComment.mock.calls[0][3]).toContain('Possible null dereference');
    expect(mockAddComment.mock.calls[0][3]).toContain('gbf-bugbot');
    expect(mockAddComment.mock.calls[0][3]).toContain('finding_id:"src/foo.ts:10:possible-null"');
    expect(mockUpdateComment).not.toHaveBeenCalled();
  });

  it('when OpenCode returns one finding and there is an open PR, creates review comments', async () => {
    const finding = {
      id: 'src/bar.ts:5:missing-check',
      title: 'Missing validation',
      description: 'Add null check.',
      file: 'src/bar.ts',
      line: 5,
    };
    mockAskAgent.mockResolvedValue({ findings: [finding] });
    mockGetOpenPullRequestNumbersByHeadBranch.mockResolvedValue([100]);
    mockGetPullRequestHeadSha.mockResolvedValue('abc123');
    mockGetChangedFiles.mockResolvedValue([{ filename: 'src/bar.ts', status: 'modified' }]);
    mockListPullRequestReviewComments.mockResolvedValue([]);

    await useCase.invoke(baseParam());

    expect(mockCreateReviewWithComments).toHaveBeenCalledTimes(1);
    expect(mockCreateReviewWithComments).toHaveBeenCalledWith(
      'owner',
      'repo',
      100,
      'abc123',
      expect.arrayContaining([
        expect.objectContaining({
          path: 'src/bar.ts',
          line: 5,
          body: expect.stringContaining('Missing validation'),
        }),
      ]),
      'token'
    );
  });

  it('when finding already has issue comment, updates instead of adding', async () => {
    const finding = {
      id: 'existing-finding-id',
      title: 'Existing problem',
      description: 'Still there.',
    };
    mockListIssueComments.mockResolvedValue([
      {
        id: 999,
        body: `## Existing problem\n\nDetails.\n\n<!-- gbf-bugbot finding_id:"existing-finding-id" resolved:false -->`,
        user: { login: 'bot' },
      },
    ]);
    mockAskAgent.mockResolvedValue({ findings: [finding] });

    await useCase.invoke(baseParam());

    expect(mockUpdateComment).toHaveBeenCalledWith('owner', 'repo', 42, 999, expect.any(String), 'token');
    expect(mockAddComment).not.toHaveBeenCalled();
  });

  it('when previous unresolved finding exists, prompt includes it and resolved_finding_ids marks it resolved', async () => {
    mockListIssueComments.mockResolvedValue([
      {
        id: 888,
        body: `## Old bug\n\nDescription.\n\n<!-- gbf-bugbot finding_id:"old-bug-id" resolved:false -->`,
        user: { login: 'bot' },
      },
    ]);
    mockAskAgent.mockResolvedValue({
      findings: [],
      resolved_finding_ids: ['old-bug-id'],
    });

    await useCase.invoke(baseParam());

    const prompt = mockAskAgent.mock.calls[0][2];
    expect(prompt).toContain('Previously reported issues');
    expect(prompt).toContain('old-bug-id');
    expect(prompt).toContain('Old bug');

    expect(mockUpdateComment).toHaveBeenCalledWith(
      'owner',
      'repo',
      42,
      888,
      expect.stringContaining('Resolved'),
      'token'
    );
    expect(mockUpdateComment.mock.calls[0][4]).toContain('resolved:true');
  });

  it('when OpenCode returns resolved_finding_ids, updates PR review comment to resolved', async () => {
    mockListIssueComments.mockResolvedValue([]);
    mockGetOpenPullRequestNumbersByHeadBranch.mockResolvedValue([50]);
    mockListPullRequestReviewComments.mockResolvedValue([
      {
        id: 777,
        body: `## PR finding\n\n<!-- gbf-bugbot finding_id:"pr-finding" resolved:false -->`,
        path: 'src/a.ts',
        line: 1,
      },
    ]);
    mockAskAgent.mockResolvedValue({
      findings: [],
      resolved_finding_ids: ['pr-finding'],
    });

    await useCase.invoke(baseParam());

    expect(mockUpdatePullRequestReviewComment).toHaveBeenCalledWith(
      'owner',
      'repo',
      777,
      expect.stringContaining('Resolved'),
      'token'
    );
    expect(mockUpdatePullRequestReviewComment.mock.calls[0][3]).toContain('resolved:true');
  });

  it('does not mark as resolved when finding id is not in resolved_finding_ids', async () => {
    mockListIssueComments.mockResolvedValue([
      {
        id: 666,
        body: `## Unfixed\n\n<!-- gbf-bugbot finding_id:"unfixed-id" resolved:false -->`,
        user: {},
      },
    ]);
    mockAskAgent.mockResolvedValue({
      findings: [],
      resolved_finding_ids: [], // not including unfixed-id
    });

    await useCase.invoke(baseParam());

    expect(mockUpdateComment).not.toHaveBeenCalled();
  });

  it('returns failure result when askAgent throws', async () => {
    mockAskAgent.mockRejectedValue(new Error('OpenCode timeout'));

    const results = await useCase.invoke(baseParam());

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
    expect(results[0].executed).toBe(true);
    expect(results[0].errors?.some((e) => String(e).includes('DetectPotentialProblemsUseCase'))).toBe(true);
    expect(results[0].errors?.some((e) => String(e).includes('OpenCode timeout'))).toBe(true);
  });

  it('step message includes both findings count and resolved count when both present', async () => {
    mockAskAgent.mockResolvedValue({
      findings: [
        { id: 'new-1', title: 'New', description: 'D' },
      ],
      resolved_finding_ids: ['old-1'],
    });
    mockListIssueComments.mockResolvedValue([
      { id: 1, body: '<!-- gbf-bugbot finding_id:"old-1" resolved:false -->', user: {} },
    ]);

    const results = await useCase.invoke(baseParam());

    expect(results[0].success).toBe(true);
    expect(results[0].steps?.[0]).toMatch(/1 new\/current finding\(s\).*1 marked as resolved/);
  });

  it('when there are no open PRs, does not call createReviewWithComments or getPullRequestHeadSha', async () => {
    mockGetOpenPullRequestNumbersByHeadBranch.mockResolvedValue([]);
    mockAskAgent.mockResolvedValue({
      findings: [{ id: 'f1', title: 'T', description: 'D' }],
    });

    await useCase.invoke(baseParam());

    expect(mockGetPullRequestHeadSha).not.toHaveBeenCalled();
    expect(mockCreateReviewWithComments).not.toHaveBeenCalled();
    expect(mockAddComment).toHaveBeenCalledTimes(1);
  });

  it('when finding has no file/line, PR comment uses first changed file and line 1', async () => {
    mockAskAgent.mockResolvedValue({
      findings: [{ id: 'no-loc', title: 'General issue', description: 'No location.' }],
    });
    mockGetOpenPullRequestNumbersByHeadBranch.mockResolvedValue([200]);
    mockGetPullRequestHeadSha.mockResolvedValue('sha1');
    mockGetChangedFiles.mockResolvedValue([{ filename: 'lib/helper.ts', status: 'modified' }]);
    mockListPullRequestReviewComments.mockResolvedValue([]);

    await useCase.invoke(baseParam());

    expect(mockCreateReviewWithComments).toHaveBeenCalledWith(
      'owner',
      'repo',
      200,
      'sha1',
      expect.arrayContaining([
        expect.objectContaining({
          path: 'lib/helper.ts',
          line: 1,
        }),
      ]),
      'token'
    );
  });

  it('when existing finding has prCommentId for same PR, updates review comment instead of creating', async () => {
    const finding = {
      id: 'same-pr-finding',
      title: 'Same',
      description: 'Desc',
    };
    mockListIssueComments.mockResolvedValue([]);
    mockGetOpenPullRequestNumbersByHeadBranch.mockResolvedValue([60]);
    mockListPullRequestReviewComments.mockResolvedValue([
      {
        id: 555,
        body: `## Same\n\n<!-- gbf-bugbot finding_id:"same-pr-finding" resolved:false -->`,
        path: 'x.ts',
        line: 1,
      },
    ]);
    mockGetPullRequestHeadSha.mockResolvedValue('sha2');
    mockGetChangedFiles.mockResolvedValue([{ filename: 'x.ts', status: 'modified' }]);
    mockAskAgent.mockResolvedValue({ findings: [finding] });

    await useCase.invoke(baseParam());

    expect(mockUpdatePullRequestReviewComment).toHaveBeenCalledWith(
      'owner',
      'repo',
      555,
      expect.stringContaining('Same'),
      'token'
    );
    expect(mockCreateReviewWithComments).not.toHaveBeenCalled();
  });

  it('uses branches.development when currentConfiguration.parentBranch is undefined', async () => {
    mockAskAgent.mockResolvedValue({ findings: [], resolved_finding_ids: [] });
    const param = baseParam({
      currentConfiguration: { parentBranch: undefined },
      branches: { development: 'main' },
    });

    await useCase.invoke(param);

    const prompt = mockAskAgent.mock.calls[0][2];
    expect(prompt).toContain('Base branch: main');
  });

  it('extracts title from comment body (## line) for previous findings in prompt', async () => {
    mockListIssueComments.mockResolvedValue([
      {
        id: 111,
        body: `## Extracted Title Here\n\nSome body.\n\n<!-- gbf-bugbot finding_id:"ex-id" resolved:false -->`,
        user: {},
      },
    ]);
    mockAskAgent.mockResolvedValue({ findings: [], resolved_finding_ids: [] });

    await useCase.invoke(baseParam());

    const prompt = mockAskAgent.mock.calls[0][2];
    expect(prompt).toContain('Extracted Title Here');
    expect(prompt).toContain('ex-id');
  });

  it('treats non-array findings as empty and returns success with no new findings', async () => {
    mockAskAgent.mockResolvedValue({ findings: 'not-array' });

    const results = await useCase.invoke(baseParam());

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);
    expect(results[0].steps?.[0]).toContain('no new findings, no resolved');
    expect(mockAddComment).not.toHaveBeenCalled();
  });

  it('does not update comment to resolved when already resolved in marker', async () => {
    mockListIssueComments.mockResolvedValue([
      {
        id: 222,
        body: `## Already resolved\n\n<!-- gbf-bugbot finding_id:"done-id" resolved:true -->`,
        user: {},
      },
    ]);
    mockAskAgent.mockResolvedValue({
      findings: [],
      resolved_finding_ids: ['done-id'], // OpenCode says resolved again
    });

    await useCase.invoke(baseParam());

    expect(mockUpdateComment).not.toHaveBeenCalled();
  });

  describe('marker replacement (regex-based, tolerates format variations)', () => {
    it('replaces marker in issue comment when marker has extra whitespace', async () => {
      mockListIssueComments.mockResolvedValue([
        {
          id: 333,
          body: `## Whitespace variant\n\n<!--  gbf-bugbot   finding_id: "spacey-id"   resolved:false -->`,
          user: { login: 'bot' },
        },
      ]);
      mockAskAgent.mockResolvedValue({
        findings: [],
        resolved_finding_ids: ['spacey-id'],
      });

      await useCase.invoke(baseParam());

      expect(mockUpdateComment).toHaveBeenCalledTimes(1);
      expect(mockUpdateComment).toHaveBeenCalledWith(
        'owner',
        'repo',
        42,
        333,
        expect.any(String),
        'token'
      );
      const updatedBody = mockUpdateComment.mock.calls[0][4];
      expect(updatedBody).toContain('resolved:true');
      expect(updatedBody).toContain('**Resolved** (OpenCode confirmed fixed in latest analysis)');
      expect(updatedBody).toContain('gbf-bugbot');
    });

    it('replaces marker in PR review comment when marker has extra whitespace', async () => {
      mockListIssueComments.mockResolvedValue([]);
      mockGetOpenPullRequestNumbersByHeadBranch.mockResolvedValue([80]);
      mockListPullRequestReviewComments
        .mockResolvedValueOnce([
          {
            id: 444,
            body: `## PR spacey\n\n<!--  gbf-bugbot   finding_id: "pr-spacey-id"   resolved:false   -->`,
            path: 'src/b.ts',
            line: 1,
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 444,
            body: `## PR spacey\n\n<!--  gbf-bugbot   finding_id: "pr-spacey-id"   resolved:false   -->`,
            path: 'src/b.ts',
            line: 1,
          },
        ]);
      mockAskAgent.mockResolvedValue({
        findings: [],
        resolved_finding_ids: ['pr-spacey-id'],
      });

      await useCase.invoke(baseParam());

      expect(mockUpdatePullRequestReviewComment).toHaveBeenCalledTimes(1);
      const updatedBody = mockUpdatePullRequestReviewComment.mock.calls[0][3];
      expect(updatedBody).toContain('resolved:true');
      expect(updatedBody).toContain('**Resolved** (OpenCode confirmed fixed in latest analysis)');
    });

    it('replaces marker when finding id contains regex-special characters', async () => {
      const findingId = 'src/utils (helper).ts:10:possible-null';
      mockListIssueComments.mockResolvedValue([
        {
          id: 555,
          body: `## Regex id\n\n<!-- gbf-bugbot finding_id:"${findingId}" resolved:false -->`,
          user: {},
        },
      ]);
      mockAskAgent.mockResolvedValue({
        findings: [],
        resolved_finding_ids: [findingId],
      });

      await useCase.invoke(baseParam());

      expect(mockUpdateComment).toHaveBeenCalledTimes(1);
      const updatedBody = mockUpdateComment.mock.calls[0][4];
      expect(updatedBody).toContain('resolved:true');
      expect(updatedBody).toContain(findingId);
    });

    it('sanitizes finding id so HTML comment-breaking chars do not appear in marker', async () => {
      const findingWithBadChars = 'file.ts:1:bad-->id<!with<newline>\nhere';
      mockAskAgent.mockResolvedValue({
        findings: [
          {
            id: findingWithBadChars,
            title: 'Sanitized ID',
            description: 'Finding with unsafe ID chars.',
          },
        ],
      });

      await useCase.invoke(baseParam());

      expect(mockAddComment).toHaveBeenCalledTimes(1);
      const body = mockAddComment.mock.calls[0][3];
      expect(body).toContain('gbf-bugbot');
      const markerMatch = body.match(/<!--\s*gbf-bugbot\s+finding_id:\s*"([^"]+)"\s+resolved:/);
      expect(markerMatch).toBeTruthy();
      const storedId = markerMatch![1];
      expect(storedId).not.toContain('-->');
      expect(storedId).not.toContain('<!');
      expect(storedId).not.toContain('<');
      expect(storedId).not.toContain('>');
      expect(storedId).not.toContain('\n');
      expect(storedId).toBe('file.ts:1:badidwithnewlinehere');
      expect(body).toMatch(/<!--\s*gbf-bugbot\s+finding_id:\s*"file\.ts:1:badidwithnewlinehere"\s+resolved:false\s*-->/);
    });
  });
});
