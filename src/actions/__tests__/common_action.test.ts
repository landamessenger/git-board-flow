/**
 * Unit tests for mainRun (common_action).
 * Mocks use cases and queue; covers dispatch branches and error handling.
 */

jest.mock('chalk', () => ({
  cyan: (s: string) => s,
  gray: (s: string) => s,
  default: { cyan: (s: string) => s, gray: (s: string) => s },
}));
jest.mock('boxen', () => jest.fn((text: string) => text));

import { mainRun } from '../common_action';
import type { Execution } from '../../data/model/execution';
import { Result } from '../../data/model/result';

jest.mock('@actions/core', () => ({
  setFailed: jest.fn(),
}));

jest.mock('../../utils/logger', () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
}));

jest.mock('../../utils/queue_utils', () => ({
  waitForPreviousRuns: jest.fn().mockResolvedValue(undefined),
}));

const mockSingleActionInvoke = jest.fn();
const mockIssueCommentInvoke = jest.fn();
const mockIssueInvoke = jest.fn();
const mockPullRequestReviewCommentInvoke = jest.fn();
const mockPullRequestInvoke = jest.fn();
const mockCommitInvoke = jest.fn();

jest.mock('../../usecase/single_action_use_case', () => ({
  SingleActionUseCase: jest.fn().mockImplementation(() => ({
    invoke: mockSingleActionInvoke,
  })),
}));
jest.mock('../../usecase/issue_comment_use_case', () => ({
  IssueCommentUseCase: jest.fn().mockImplementation(() => ({
    invoke: mockIssueCommentInvoke,
  })),
}));
jest.mock('../../usecase/issue_use_case', () => ({
  IssueUseCase: jest.fn().mockImplementation(() => ({
    invoke: mockIssueInvoke,
  })),
}));
jest.mock('../../usecase/pull_request_review_comment_use_case', () => ({
  PullRequestReviewCommentUseCase: jest.fn().mockImplementation(() => ({
    invoke: mockPullRequestReviewCommentInvoke,
  })),
}));
jest.mock('../../usecase/pull_request_use_case', () => ({
  PullRequestUseCase: jest.fn().mockImplementation(() => ({
    invoke: mockPullRequestInvoke,
  })),
}));
jest.mock('../../usecase/commit_use_case', () => ({
  CommitUseCase: jest.fn().mockImplementation(() => ({
    invoke: mockCommitInvoke,
  })),
}));

const core = require('@actions/core');
const { waitForPreviousRuns } = require('../../utils/queue_utils');

function mockExecution(overrides: Record<string, unknown> = {}): Execution {
  const base = {
    setup: jest.fn().mockResolvedValue(undefined),
    welcome: undefined,
    runnedByToken: false,
    tokenUser: 'user',
    isSingleAction: false,
    singleAction: {
      validSingleAction: false,
      isSingleActionWithoutIssue: false,
      enabledSingleAction: false,
    },
    issueNumber: 42,
    isIssue: false,
    issue: { isIssueComment: false, isIssue: false },
    isPullRequest: false,
    pullRequest: { isPullRequestReviewComment: false, isPullRequest: false },
    isPush: false,
    ...overrides,
  };
  return base as unknown as Execution;
}

describe('mainRun', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (waitForPreviousRuns as jest.Mock).mockResolvedValue(undefined);
    mockSingleActionInvoke.mockResolvedValue([]);
    mockIssueCommentInvoke.mockResolvedValue([]);
    mockIssueInvoke.mockResolvedValue([]);
    mockPullRequestReviewCommentInvoke.mockResolvedValue([]);
    mockPullRequestInvoke.mockResolvedValue([]);
    mockCommitInvoke.mockResolvedValue([]);
  });

  it('calls execution.setup()', async () => {
    const setupMock = jest.fn().mockResolvedValue(undefined);
    const execution = mockExecution({ setup: setupMock });
    await mainRun(execution);
    expect(setupMock).toHaveBeenCalledTimes(1);
  });

  it('waits for previous runs when welcome is false', async () => {
    const execution = mockExecution({ welcome: undefined });
    await mainRun(execution);
    expect(waitForPreviousRuns).toHaveBeenCalledWith(execution);
  });

  it('skips wait when welcome is set', async () => {
    const execution = mockExecution({
      welcome: { title: 'Hi', messages: ['Welcome'] },
      isPush: true,
    });
    await mainRun(execution);
    expect(waitForPreviousRuns).not.toHaveBeenCalled();
    expect(mockCommitInvoke).toHaveBeenCalled();
  });

  it('runs SingleActionUseCase when runnedByToken and valid single action', async () => {
    const execution = mockExecution({
      runnedByToken: true,
      isSingleAction: true,
      singleAction: {
        validSingleAction: true,
        isSingleActionWithoutIssue: false,
        enabledSingleAction: true,
      },
    });
    const expected = [new Result({ id: 's', success: true, executed: true })];
    mockSingleActionInvoke.mockResolvedValue(expected);

    const results = await mainRun(execution);

    expect(mockSingleActionInvoke).toHaveBeenCalledWith(execution);
    expect(results).toEqual(expected);
    expect(mockCommitInvoke).not.toHaveBeenCalled();
  });

  it('returns empty when runnedByToken but not valid single action', async () => {
    const execution = mockExecution({
      runnedByToken: true,
      isSingleAction: false,
    });

    const results = await mainRun(execution);

    expect(results).toEqual([]);
    expect(mockSingleActionInvoke).not.toHaveBeenCalled();
  });

  it('runs SingleActionUseCase when issueNumber -1 and isSingleActionWithoutIssue', async () => {
    const execution = mockExecution({
      issueNumber: -1,
      isSingleAction: true,
      singleAction: {
        validSingleAction: false,
        isSingleActionWithoutIssue: true,
        enabledSingleAction: true,
      },
    });
    mockSingleActionInvoke.mockResolvedValue([new Result({ id: 't', success: true })]);

    const results = await mainRun(execution);

    expect(mockSingleActionInvoke).toHaveBeenCalledWith(execution);
    expect(results.length).toBeGreaterThan(0);
  });

  it('returns empty when issueNumber -1 and not single action without issue', async () => {
    const execution = mockExecution({
      issueNumber: -1,
      isSingleAction: false,
    });

    const results = await mainRun(execution);

    expect(results).toEqual([]);
    expect(mockSingleActionInvoke).not.toHaveBeenCalled();
  });

  it('runs IssueCommentUseCase when isIssue and issue comment', async () => {
    const execution = mockExecution({
      isIssue: true,
      issue: { isIssueComment: true, isIssue: false },
    });
    const expected = [new Result({ id: 'ic', success: true })];
    mockIssueCommentInvoke.mockResolvedValue(expected);

    const results = await mainRun(execution);

    expect(mockIssueCommentInvoke).toHaveBeenCalledWith(execution);
    expect(results).toEqual(expected);
  });

  it('runs IssueUseCase when isIssue and not issue comment', async () => {
    const execution = mockExecution({
      isIssue: true,
      issue: { isIssueComment: false, isIssue: true },
    });
    const expected = [new Result({ id: 'i', success: true })];
    mockIssueInvoke.mockResolvedValue(expected);

    const results = await mainRun(execution);

    expect(mockIssueInvoke).toHaveBeenCalledWith(execution);
    expect(results).toEqual(expected);
  });

  it('runs PullRequestReviewCommentUseCase when isPullRequest and review comment', async () => {
    const execution = mockExecution({
      isPullRequest: true,
      pullRequest: { isPullRequestReviewComment: true, isPullRequest: false },
    });
    const expected = [new Result({ id: 'prc', success: true })];
    mockPullRequestReviewCommentInvoke.mockResolvedValue(expected);

    const results = await mainRun(execution);

    expect(mockPullRequestReviewCommentInvoke).toHaveBeenCalledWith(execution);
    expect(results).toEqual(expected);
  });

  it('runs PullRequestUseCase when isPullRequest and not review comment', async () => {
    const execution = mockExecution({
      isPullRequest: true,
      pullRequest: { isPullRequestReviewComment: false, isPullRequest: true },
    });
    const expected = [new Result({ id: 'pr', success: true })];
    mockPullRequestInvoke.mockResolvedValue(expected);

    const results = await mainRun(execution);

    expect(mockPullRequestInvoke).toHaveBeenCalledWith(execution);
    expect(results).toEqual(expected);
  });

  it('runs CommitUseCase when isPush', async () => {
    const execution = mockExecution({ isPush: true });
    const expected = [new Result({ id: 'c', success: true })];
    mockCommitInvoke.mockResolvedValue(expected);

    const results = await mainRun(execution);

    expect(mockCommitInvoke).toHaveBeenCalledWith(execution);
    expect(results).toEqual(expected);
  });

  it('calls core.setFailed when action not handled', async () => {
    const execution = mockExecution({
      isIssue: false,
      isPullRequest: false,
      isPush: false,
    });

    const results = await mainRun(execution);

    expect(core.setFailed).toHaveBeenCalledWith('Action not handled.');
    expect(results).toEqual([]);
  });

  it('calls core.setFailed and returns [] when use case throws', async () => {
    const execution = mockExecution({ isPush: true });
    mockCommitInvoke.mockRejectedValue(new Error('Commit failed'));

    const results = await mainRun(execution);

    expect(core.setFailed).toHaveBeenCalledWith('Commit failed');
    expect(results).toEqual([]);
  });

  it('exits process when waitForPreviousRuns rejects and welcome is false', async () => {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {}) as () => never);
    (waitForPreviousRuns as jest.Mock).mockRejectedValue(new Error('Queue error'));
    const execution = mockExecution({ welcome: undefined });

    await mainRun(execution);

    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
  });
});
