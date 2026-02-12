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

  it('uses release title and image when isIssue and release.active', async () => {
    mockAddComment.mockResolvedValue(undefined);
    const param = baseParam({
      isIssue: true,
      release: { active: true },
      currentConfiguration: { results: [new Result({ id: 'a', success: true, executed: true, steps: ['Step'] })] },
    });
    await useCase.invoke(param);
    expect(mockAddComment).toHaveBeenCalledWith('o', 'r', 42, expect.stringContaining('Release Actions'), 't');
  });

  it('uses hotfix title when isIssue and hotfix.active', async () => {
    mockAddComment.mockResolvedValue(undefined);
    const param = baseParam({
      isIssue: true,
      hotfix: { active: true },
      currentConfiguration: { results: [new Result({ id: 'a', success: true, executed: true, steps: ['Step'] })] },
    });
    await useCase.invoke(param);
    expect(mockAddComment).toHaveBeenCalledWith('o', 'r', 42, expect.stringContaining('Hotfix Actions'), 't');
  });

  it('uses feature title when isIssue and isFeature', async () => {
    mockAddComment.mockResolvedValue(undefined);
    const param = baseParam({
      isIssue: true,
      isFeature: true,
      currentConfiguration: { results: [new Result({ id: 'a', success: true, executed: true, steps: ['Step'] })] },
    });
    await useCase.invoke(param);
    expect(mockAddComment).toHaveBeenCalledWith('o', 'r', 42, expect.stringContaining('Feature Actions'), 't');
  });

  it('uses docs title when isIssue and isDocs', async () => {
    mockAddComment.mockResolvedValue(undefined);
    const param = baseParam({
      isIssue: true,
      isDocs: true,
      currentConfiguration: { results: [new Result({ id: 'a', success: true, executed: true, steps: ['Step'] })] },
    });
    await useCase.invoke(param);
    expect(mockAddComment).toHaveBeenCalledWith('o', 'r', 42, expect.stringContaining('Documentation Actions'), 't');
  });

  it('uses chore title when isPullRequest and isChore', async () => {
    mockAddComment.mockResolvedValue(undefined);
    const param = baseParam({
      isPullRequest: true,
      isChore: true,
      currentConfiguration: { results: [new Result({ id: 'a', success: true, executed: true, steps: ['Step'] })] },
    });
    await useCase.invoke(param);
    expect(mockAddComment).toHaveBeenCalledWith('o', 'r', 99, expect.stringContaining('Chore Actions'), 't');
  });

  it('uses Automatic Actions and singleAction.issue when isSingleAction', async () => {
    mockAddComment.mockResolvedValue(undefined);
    const param = baseParam({
      isSingleAction: true,
      singleAction: { issue: 456 },
      currentConfiguration: { results: [new Result({ id: 'a', success: true, executed: true, steps: ['Step'] })] },
    });
    await useCase.invoke(param);
    expect(mockAddComment).toHaveBeenCalledWith('o', 'r', 456, expect.any(String), 't');
  });

  it('includes reminder section when results have reminders', async () => {
    mockAddComment.mockResolvedValue(undefined);
    const param = baseParam({
      isIssue: true,
      currentConfiguration: {
        results: [
          new Result({ id: 'a', success: true, executed: true, steps: ['Step'], reminders: ['Remind me'] }),
        ],
      },
    });
    await useCase.invoke(param);
    expect(mockAddComment).toHaveBeenCalledWith('o', 'r', 42, expect.stringContaining('Reminder'), 't');
    expect(mockAddComment).toHaveBeenCalledWith('o', 'r', 42, expect.stringContaining('1. Remind me'), 't');
  });

  it('includes errors section when results have errors', async () => {
    mockAddComment.mockResolvedValue(undefined);
    const param = baseParam({
      isIssue: true,
      currentConfiguration: {
        results: [
          new Result({ id: 'a', success: true, executed: true, steps: ['Step'], errors: ['Something failed'] }),
        ],
      },
    });
    await useCase.invoke(param);
    expect(mockAddComment).toHaveBeenCalledWith('o', 'r', 42, expect.stringContaining('Errors Found'), 't');
  });

  it('calls addComment on issueNumber when isPush and issueNumber > 0', async () => {
    mockAddComment.mockResolvedValue(undefined);
    const param = baseParam({
      isPush: true,
      issueNumber: 7,
      currentConfiguration: { results: [new Result({ id: 'a', success: true, executed: true, steps: ['Step'] })] },
    });
    await useCase.invoke(param);
    expect(mockAddComment).toHaveBeenCalledWith('o', 'r', 7, expect.any(String), 't');
  });
});
