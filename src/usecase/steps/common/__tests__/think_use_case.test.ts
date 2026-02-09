import { ThinkUseCase } from '../think_use_case';
import { Ai } from '../../../../data/model/ai';

jest.mock('../../../../utils/logger', () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
}));

const mockAsk = jest.fn();
const mockAddComment = jest.fn();
const mockGetDescription = jest.fn();
jest.mock('../../../../data/repository/ai_repository', () => ({
  AiRepository: jest.fn().mockImplementation(() => ({ ask: mockAsk })),
}));
jest.mock('../../../../data/repository/issue_repository', () => ({
  IssueRepository: jest.fn().mockImplementation(() => ({
    addComment: mockAddComment,
    getDescription: mockGetDescription,
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
      isIssueComment: true,
      isIssue: false,
      commentBody: '',
      number: 1,
      commentId: 42,
    },
    pullRequest: { isPullRequestReviewComment: false, commentBody: '', number: 5 },
    singleAction: { isThinkAction: false },
    commit: { branch: 'main' },
    ...overrides,
  } as unknown as Parameters<ThinkUseCase['invoke']>[0];
}

describe('ThinkUseCase', () => {
  let useCase: ThinkUseCase;

  beforeEach(() => {
    useCase = new ThinkUseCase();
    mockAsk.mockReset();
    mockAddComment.mockReset();
    mockGetDescription.mockReset();
    mockGetDescription.mockResolvedValue(undefined);
  });

  it('returns success executed false when comment body is empty', async () => {
    const param = baseParam({ issue: { ...baseParam().issue, commentBody: '' } });

    const results = await useCase.invoke(param);

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);
    expect(results[0].executed).toBe(false);
    expect(mockAsk).not.toHaveBeenCalled();
    expect(mockAddComment).not.toHaveBeenCalled();
  });

  it('returns success executed false when tokenUser is not set', async () => {
    const param = baseParam({
      tokenUser: '',
      issue: { ...baseParam().issue, commentBody: '@bot what is 2+2?' },
    });

    const results = await useCase.invoke(param);

    expect(results[0].success).toBe(true);
    expect(results[0].executed).toBe(false);
    expect(mockAsk).not.toHaveBeenCalled();
  });

  it('returns success executed false when comment does not mention @user', async () => {
    const param = baseParam({
      issue: { ...baseParam().issue, commentBody: 'hello world' },
    });

    const results = await useCase.invoke(param);

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);
    expect(results[0].executed).toBe(false);
    expect(mockAsk).not.toHaveBeenCalled();
    expect(mockAddComment).not.toHaveBeenCalled();
  });

  it('returns error when OpenCode model is empty', async () => {
    const param = baseParam({
      ai: new Ai('https://server', '', false, false, [], false),
      issue: { ...baseParam().issue, commentBody: '@bot hi' },
    });

    const results = await useCase.invoke(param);

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
    expect(results[0].errors).toContain('OpenCode server URL or model not found.');
    expect(mockAsk).not.toHaveBeenCalled();
  });

  it('returns error when OpenCode server URL is empty', async () => {
    const param = baseParam({
      ai: new Ai('', 'model', false, false, [], false),
      issue: { ...baseParam().issue, commentBody: '@bot hi' },
    });

    const results = await useCase.invoke(param);

    expect(results[0].success).toBe(false);
    expect(results[0].errors).toContain('OpenCode server URL or model not found.');
  });

  it('returns success executed false when comment is only the mention', async () => {
    const param = baseParam({
      issue: { ...baseParam().issue, commentBody: '@bot   ' },
    });

    const results = await useCase.invoke(param);

    expect(results[0].success).toBe(true);
    expect(results[0].executed).toBe(false);
    expect(mockAsk).not.toHaveBeenCalled();
  });

  it('calls getDescription then ask and addComment when comment mentions bot', async () => {
    mockGetDescription.mockResolvedValue(undefined);
    mockAsk.mockResolvedValue('4');
    mockAddComment.mockResolvedValue(undefined);
    const param = baseParam({
      issue: { ...baseParam().issue, commentBody: '@bot what is 2+2?' },
    });

    const results = await useCase.invoke(param);

    expect(mockGetDescription).toHaveBeenCalledWith('o', 'r', 1, 't');
    expect(mockAsk).toHaveBeenCalledTimes(1);
    expect(mockAddComment).toHaveBeenCalledWith('o', 'r', 1, '4', 't');
    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);
    expect(results[0].executed).toBe(true);
  });

  it('includes issue description in prompt when getDescription returns content', async () => {
    mockGetDescription.mockResolvedValue('Implement login feature for the app.');
    mockAsk.mockResolvedValue('Sure, here is how...');
    mockAddComment.mockResolvedValue(undefined);
    const param = baseParam({
      issue: { ...baseParam().issue, commentBody: '@bot how should I start?', number: 42 },
    });

    await useCase.invoke(param);

    expect(mockGetDescription).toHaveBeenCalledWith('o', 'r', 42, 't');
    const prompt = mockAsk.mock.calls[0][1];
    expect(prompt).toContain('Context (issue #42 description):');
    expect(prompt).toContain('Implement login feature for the app.');
    expect(prompt).toContain('Question: how should I start?');
  });

  it('for PR review comment uses issueNumber to fetch issue description', async () => {
    mockGetDescription.mockResolvedValue('Original issue description.');
    mockAsk.mockResolvedValue('Reply');
    mockAddComment.mockResolvedValue(undefined);
    const param = baseParam({
      issue: { ...baseParam().issue, isIssueComment: false, commentBody: '', number: 0 },
      pullRequest: {
        isPullRequestReviewComment: true,
        commentBody: '@bot summarize',
        number: 7,
      },
      issueNumber: 123,
    });

    await useCase.invoke(param);

    expect(mockGetDescription).toHaveBeenCalledWith('o', 'r', 123, 't');
    const prompt = mockAsk.mock.calls[0][1];
    expect(prompt).toContain('Context (issue #123 description):');
    expect(prompt).toContain('Original issue description.');
  });

  it('returns error when OpenCode returns no answer', async () => {
    mockAsk.mockResolvedValue(undefined);
    const param = baseParam({
      issue: { ...baseParam().issue, commentBody: '@bot hello' },
    });

    const results = await useCase.invoke(param);

    expect(mockAsk).toHaveBeenCalledTimes(1);
    expect(mockAddComment).not.toHaveBeenCalled();
    expect(results[0].success).toBe(false);
    expect(results[0].executed).toBe(true);
    expect(results[0].errors).toContain('OpenCode returned no answer.');
  });

  it('posts comment to PR number when pull_request_review_comment', async () => {
    mockAsk.mockResolvedValue('Reply');
    mockAddComment.mockResolvedValue(undefined);
    const param = baseParam({
      issue: { ...baseParam().issue, isIssueComment: false, commentBody: '' },
      pullRequest: {
        isPullRequestReviewComment: true,
        commentBody: '@bot explain this',
        number: 7,
      },
    });

    const results = await useCase.invoke(param);

    expect(mockAddComment).toHaveBeenCalledWith('o', 'r', 7, 'Reply', 't');
    expect(results[0].success).toBe(true);
    expect(results[0].executed).toBe(true);
  });

  it('returns error result when addComment throws', async () => {
    mockAsk.mockResolvedValue('ok');
    mockAddComment.mockRejectedValue(new Error('API error'));
    const param = baseParam({
      issue: { ...baseParam().issue, commentBody: '@bot hi' },
    });

    const results = await useCase.invoke(param);

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
    expect(results[0].errors?.some((e) => String(e).includes('ThinkUseCase'))).toBe(true);
  });
});
