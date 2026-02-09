import { Result } from '../../../../data/model/result';
import { PublishResultUseCase } from '../publish_resume_use_case';

jest.mock('../../../../utils/logger', () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
}));

jest.mock('../../../../utils/list_utils', () => ({
  getRandomElement: jest.fn(() => undefined),
}));

const mockAddComment = jest.fn();
jest.mock('../../../../data/repository/issue_repository', () => ({
  IssueRepository: jest.fn().mockImplementation(() => ({
    addComment: mockAddComment,
  })),
}));

function baseParam(overrides: Record<string, unknown> = {}) {
  const defaultConfig = { results: [new Result({ id: 'x', success: true, executed: true, steps: ['Step 1'] })] };
  return {
    owner: 'o',
    repo: 'r',
    issueNumber: 42,
    issue: { number: 42 },
    pullRequest: { number: 99 },
    isIssue: false,
    isPullRequest: false,
    isPush: false,
    isSingleAction: false,
    currentConfiguration: defaultConfig,
    tokens: { token: 't' },
    images: {
      imagesOnIssue: true,
      imagesOnPullRequest: true,
      issueAutomaticActions: [],
      issueReleaseGifs: [],
      issueHotfixGifs: [],
      issueBugfixGifs: [],
      issueFeatureGifs: [],
      issueDocsGifs: [],
      issueChoreGifs: [],
      pullRequestReleaseGifs: [],
      pullRequestHotfixGifs: [],
      pullRequestBugfixGifs: [],
      pullRequestFeatureGifs: [],
      pullRequestDocsGifs: [],
      pullRequestChoreGifs: [],
      pullRequestAutomaticActions: [],
    },
    singleAction: { issue: 123 },
    release: { active: false },
    hotfix: { active: false },
    issueNotBranched: false,
    ...overrides,
  } as unknown as Parameters<PublishResultUseCase['invoke']>[0];
}

describe('PublishResultUseCase', () => {
  let useCase: PublishResultUseCase;

  beforeEach(() => {
    useCase = new PublishResultUseCase();
    mockAddComment.mockReset();
  });

  it('does not call addComment when content is empty (no steps in results)', async () => {
    const param = baseParam({
      isIssue: true,
      currentConfiguration: { results: [new Result({ id: 'x', success: true, executed: true, steps: [] })] },
    });

    await useCase.invoke(param);

    expect(mockAddComment).not.toHaveBeenCalled();
  });

  it('calls addComment on issue when isIssue and results have steps', async () => {
    mockAddComment.mockResolvedValue(undefined);
    const param = baseParam({ isIssue: true });
    const resultsWithSteps = [new Result({ id: 'a', success: true, executed: true, steps: ['Step 1'] })];
    param.currentConfiguration = { results: resultsWithSteps } as Parameters<PublishResultUseCase['invoke']>[0]['currentConfiguration'];

    await useCase.invoke(param);

    expect(mockAddComment).toHaveBeenCalledTimes(1);
    expect(mockAddComment).toHaveBeenCalledWith('o', 'r', 42, expect.stringContaining('1. Step 1'), 't');
  });

  it('calls addComment on pull request when isPullRequest and results have steps', async () => {
    mockAddComment.mockResolvedValue(undefined);
    const param = baseParam({ isPullRequest: true });
    const resultsWithSteps = [new Result({ id: 'a', success: true, executed: true, steps: ['Step 1'] })];
    param.currentConfiguration = { results: resultsWithSteps } as Parameters<PublishResultUseCase['invoke']>[0]['currentConfiguration'];

    await useCase.invoke(param);

    expect(mockAddComment).toHaveBeenCalledTimes(1);
    expect(mockAddComment).toHaveBeenCalledWith('o', 'r', 99, expect.stringContaining('1. Step 1'), 't');
  });

  it('pushes failure result to currentConfiguration.results when addComment throws', async () => {
    mockAddComment.mockRejectedValue(new Error('API error'));
    const param = baseParam({ isIssue: true });
    const initialLength = param.currentConfiguration.results.length;

    await useCase.invoke(param);

    expect(param.currentConfiguration.results.length).toBe(initialLength + 1);
    const lastResult = param.currentConfiguration.results[param.currentConfiguration.results.length - 1];
    expect(lastResult.success).toBe(false);
    expect(lastResult.steps).toContain('Tried to publish the resume, but there was a problem.');
  });
});
