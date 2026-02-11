import { NotifyNewCommitOnIssueUseCase } from '../notify_new_commit_on_issue_use_case';

jest.mock('../../../../utils/logger', () => ({
  logInfo: jest.fn(),
  logDebugInfo: jest.fn(),
  logError: jest.fn(),
}));

jest.mock('../../../../utils/list_utils', () => ({
  getRandomElement: jest.fn((arr: string[]) => arr[0]),
}));

const mockAddComment = jest.fn();
const mockOpenIssue = jest.fn();
jest.mock('../../../../data/repository/issue_repository', () => ({
  IssueRepository: jest.fn().mockImplementation(() => ({
    addComment: mockAddComment,
    openIssue: mockOpenIssue,
  })),
}));

const mockInvoke = jest.fn();
jest.mock('../../common/execute_script_use_case', () => ({
  CommitPrefixBuilderUseCase: jest.fn().mockImplementation(() => ({
    invoke: mockInvoke,
  })),
}));

function baseParam(overrides: Record<string, unknown> = {}) {
  return {
    owner: 'o',
    repo: 'r',
    issueNumber: 42,
    tokens: { token: 't' },
    commit: {
      branch: 'feature/42-add-login',
      commits: [
        {
          id: 'abc',
          message: 'feat: add button',
          author: { name: 'Alice', username: 'alice' },
        },
      ],
    },
    commitPrefixBuilder: '',
    images: {
      commitReleaseGifs: ['url1'],
      commitHotfixGifs: ['url2'],
      commitBugfixGifs: ['url3'],
      commitFeatureGifs: ['url4'],
      commitDocsGifs: ['url5'],
      commitChoreGifs: ['url6'],
      commitAutomaticActions: ['url7'],
    },
    imagesOnCommit: true,
    issue: { reopenOnPush: false },
    release: { active: false },
    hotfix: { active: false },
    isFeature: true,
    isBugfix: false,
    isDocs: false,
    isChore: false,
    ...overrides,
  } as unknown as Parameters<NotifyNewCommitOnIssueUseCase['invoke']>[0];
}

describe('NotifyNewCommitOnIssueUseCase', () => {
  let useCase: NotifyNewCommitOnIssueUseCase;

  beforeEach(() => {
    useCase = new NotifyNewCommitOnIssueUseCase();
    mockAddComment.mockResolvedValue(undefined);
    mockOpenIssue.mockResolvedValue(true);
    mockInvoke.mockResolvedValue([
      { payload: { scriptResult: '' } },
    ]);
  });

  it('adds comment with commit info and returns', async () => {
    const param = baseParam();
    const results = await useCase.invoke(param);
    expect(mockAddComment).toHaveBeenCalledWith(
      'o',
      'r',
      42,
      expect.stringContaining('Feature News'),
      't'
    );
    expect(mockAddComment).toHaveBeenCalledWith(
      'o',
      'r',
      42,
      expect.stringContaining('feature/42-add-login'),
      't'
    );
    expect(mockAddComment).toHaveBeenCalledWith(
      'o',
      'r',
      42,
      expect.stringContaining('alice'),
      't'
    );
    expect(results).toEqual([]);
  });

  it('does not call openIssue when reopenOnPush is false', async () => {
    const param = baseParam({ issue: { reopenOnPush: false } });
    await useCase.invoke(param);
    expect(mockOpenIssue).not.toHaveBeenCalled();
  });

  it('calls openIssue and addComment when reopenOnPush is true', async () => {
    const param = baseParam({ issue: { reopenOnPush: true } });
    await useCase.invoke(param);
    expect(mockOpenIssue).toHaveBeenCalledWith('o', 'r', 42, 't');
    expect(mockAddComment).toHaveBeenCalled();
  });

  it('returns failure on error', async () => {
    mockAddComment.mockRejectedValue(new Error('API error'));
    const param = baseParam();
    const results = await useCase.invoke(param);
    expect(results.some((r) => r.success === false)).toBe(true);
    expect(results[0].errors?.length).toBeGreaterThan(0);
  });
});
