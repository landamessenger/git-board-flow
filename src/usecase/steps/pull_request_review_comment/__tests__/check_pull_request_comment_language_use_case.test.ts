import { CheckPullRequestCommentLanguageUseCase } from '../check_pull_request_comment_language_use_case';

jest.mock('../../../../utils/logger', () => ({
  logInfo: jest.fn(),
}));

const translatedKey = `<!-- content_translated
If you'd like this comment to be translated again, please delete the entire comment, including this message. It will then be processed as a new one.
-->`;

const mockAsk = jest.fn();
const mockUpdateComment = jest.fn();
jest.mock('../../../../data/repository/ai_repository', () => ({
  AiRepository: jest.fn().mockImplementation(() => ({ ask: mockAsk })),
}));
jest.mock('../../../../data/repository/issue_repository', () => ({
  IssueRepository: jest.fn().mockImplementation(() => ({ updateComment: mockUpdateComment })),
}));

function baseParam(overrides: Record<string, unknown> = {}) {
  return {
    owner: 'o',
    repo: 'r',
    pullRequest: { number: 5, commentId: 10, commentBody: 'Hello' },
    tokens: { token: 't' },
    locale: { pullRequest: 'Spanish' },
    ai: {},
    ...overrides,
  } as unknown as Parameters<CheckPullRequestCommentLanguageUseCase['invoke']>[0];
}

describe('CheckPullRequestCommentLanguageUseCase', () => {
  let useCase: CheckPullRequestCommentLanguageUseCase;

  beforeEach(() => {
    useCase = new CheckPullRequestCommentLanguageUseCase();
    mockAsk.mockReset();
    mockUpdateComment.mockReset();
  });

  it('returns success executed false when commentBody is empty', async () => {
    const param = baseParam({ pullRequest: { number: 5, commentId: 0, commentBody: '' } });

    const results = await useCase.invoke(param);

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);
    expect(results[0].executed).toBe(false);
    expect(mockAsk).not.toHaveBeenCalled();
  });

  it('returns success executed false when commentBody contains translatedKey', async () => {
    const param = baseParam({
      pullRequest: { number: 5, commentId: 0, commentBody: `Done\n${translatedKey}` },
    });

    const results = await useCase.invoke(param);

    expect(results[0].success).toBe(true);
    expect(results[0].executed).toBe(false);
    expect(mockAsk).not.toHaveBeenCalled();
  });

  it('returns success executed true when AI responds done', async () => {
    mockAsk.mockResolvedValue('done');
    const param = baseParam();

    const results = await useCase.invoke(param);

    expect(results[0].success).toBe(true);
    expect(results[0].executed).toBe(true);
    expect(mockAsk).toHaveBeenCalledTimes(1);
  });
});
