import { ThinkUseCase } from '../think_use_case';
import { Ai } from '../../../../data/model/ai';

jest.mock('../../../../utils/logger', () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
}));

const mockGetDescription = jest.fn();
jest.mock('../../../../data/repository/issue_repository', () => ({
  IssueRepository: jest.fn().mockImplementation(() => ({
    getDescription: mockGetDescription,
  })),
}));

const mockGetRepositoryContent = jest.fn();
jest.mock('../../../../data/repository/file_repository', () => ({
  FileRepository: jest.fn().mockImplementation(() => ({
    getRepositoryContent: mockGetRepositoryContent,
  })),
}));

jest.mock('../../../../utils/reasoning_visualizer', () => ({
  ReasoningVisualizer: jest.fn().mockImplementation(() => ({
    showHeader: jest.fn(),
  })),
}));

function baseParam(overrides: Record<string, unknown> = {}) {
  return {
    owner: 'o',
    repo: 'r',
    issueNumber: 1,
    tokenUser: 'bot',
    tokens: { token: 't' },
    ai: new Ai('https://opencode.example.com', 'model-x', false, false, [], false),
    issue: {
      isIssueComment: false,
      isIssue: true,
      commentBody: '',
      number: 1,
      commentId: 0,
    },
    pullRequest: { isPullRequestReviewComment: false, commentBody: '' },
    singleAction: { isThinkAction: false },
    commit: { branch: 'main' },
    ...overrides,
  } as unknown as Parameters<ThinkUseCase['invoke']>[0];
}

describe('ThinkUseCase', () => {
  let useCase: ThinkUseCase;

  beforeEach(() => {
    useCase = new ThinkUseCase();
    mockGetDescription.mockReset();
    mockGetRepositoryContent.mockReset();
  });

  it('returns error when OpenCode model is empty', async () => {
    const param = baseParam({
      ai: new Ai('https://server', '', false, false, [], false),
    });
    mockGetDescription.mockResolvedValue('desc');

    const results = await useCase.invoke(param);

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
    expect(results[0].errors).toContain('OpenCode server URL or model not found.');
    expect(mockGetDescription).toHaveBeenCalled();
  });

  it('returns error when OpenCode server URL is empty', async () => {
    const param = baseParam({
      ai: new Ai('', 'model', false, false, [], false),
    });
    mockGetDescription.mockResolvedValue('desc');

    const results = await useCase.invoke(param);

    expect(results[0].success).toBe(false);
    expect(results[0].errors).toContain('OpenCode server URL or model not found.');
  });

  it('returns error when not think action and question is empty', async () => {
    const param = baseParam({ issue: { isIssue: true, isIssueComment: false, commentBody: '' } });
    mockGetDescription.mockResolvedValue('');

    const results = await useCase.invoke(param);

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
    expect(results[0].errors).toContain('No question or prompt provided.');
  });

  it('returns success executed false when comment does not include @user', async () => {
    mockGetDescription.mockResolvedValue('hello');
    const param = baseParam({ tokenUser: 'bot', issue: { isIssue: true, isIssueComment: false, commentBody: '' } });

    const results = await useCase.invoke(param);

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);
    expect(results[0].executed).toBe(false);
    expect(mockGetRepositoryContent).not.toHaveBeenCalled();
  });

  it('returns error result when getDescription throws', async () => {
    mockGetDescription.mockRejectedValue(new Error('Network error'));
    const param = baseParam();

    const results = await useCase.invoke(param);

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
    expect(results[0].errors?.some((e) => String(e).includes('ThinkUseCase'))).toBe(true);
  });
});
