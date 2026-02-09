import { CheckIssueCommentLanguageUseCase } from '../check_issue_comment_language_use_case';

jest.mock('../../../../utils/logger', () => ({
  logInfo: jest.fn(),
}));

const translatedKey = `<!-- content_translated
If you'd like this comment to be translated again, please delete the entire comment, including this message. It will then be processed as a new one.
-->`;

const mockAsk = jest.fn();
const mockAskAgent = jest.fn();
const mockUpdateComment = jest.fn();
jest.mock('../../../../data/repository/ai_repository', () => ({
  AiRepository: jest.fn().mockImplementation(() => ({ ask: mockAsk, askAgent: mockAskAgent })),
}));
jest.mock('../../../../data/repository/issue_repository', () => ({
  IssueRepository: jest.fn().mockImplementation(() => ({ updateComment: mockUpdateComment })),
}));

function baseParam(overrides: Record<string, unknown> = {}) {
  return {
    owner: 'o',
    repo: 'r',
    issue: { number: 1, commentId: 42, commentBody: 'Hello world' },
    tokens: { token: 't' },
    locale: { issue: 'Spanish' },
    ai: {},
    ...overrides,
  } as unknown as Parameters<CheckIssueCommentLanguageUseCase['invoke']>[0];
}

describe('CheckIssueCommentLanguageUseCase', () => {
  let useCase: CheckIssueCommentLanguageUseCase;

  beforeEach(() => {
    useCase = new CheckIssueCommentLanguageUseCase();
    mockAsk.mockReset();
    mockAskAgent.mockReset();
    mockUpdateComment.mockReset();
  });

  it('returns success executed false when commentBody is empty', async () => {
    const param = baseParam({ issue: { number: 1, commentId: 0, commentBody: '' } });

    const results = await useCase.invoke(param);

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);
    expect(results[0].executed).toBe(false);
    expect(mockAsk).not.toHaveBeenCalled();
  });

  it('returns success executed false when commentBody already contains translatedKey', async () => {
    const param = baseParam({
      issue: { number: 1, commentId: 0, commentBody: `Translated text\n${translatedKey}` },
    });

    const results = await useCase.invoke(param);

    expect(results[0].success).toBe(true);
    expect(results[0].executed).toBe(false);
    expect(mockAsk).not.toHaveBeenCalled();
  });

  it('returns success executed true when AI responds done (already in locale)', async () => {
    mockAsk.mockResolvedValue('done');
    const param = baseParam();

    const results = await useCase.invoke(param);

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);
    expect(results[0].executed).toBe(true);
    expect(mockAsk).toHaveBeenCalledTimes(1);
    expect(mockUpdateComment).not.toHaveBeenCalled();
  });

  it('calls updateComment when AI responds must_translate and askAgent returns schema with translatedText', async () => {
    mockAsk.mockResolvedValueOnce('must_translate');
    mockAskAgent.mockResolvedValueOnce({ translatedText: 'Texto traducido' });
    mockUpdateComment.mockResolvedValue(undefined);
    const param = baseParam();

    const results = await useCase.invoke(param);

    expect(mockAsk).toHaveBeenCalledTimes(1);
    expect(mockAskAgent).toHaveBeenCalledTimes(1);
    expect(mockUpdateComment).toHaveBeenCalledWith(
      'o',
      'r',
      1,
      42,
      expect.stringContaining('Texto traducido'),
      't'
    );
    expect(results.length).toBeGreaterThanOrEqual(0);
  });

  it('does not update comment when askAgent returns undefined', async () => {
    mockAsk.mockResolvedValueOnce('must_translate');
    mockAskAgent.mockResolvedValueOnce(undefined);
    const param = baseParam();

    const results = await useCase.invoke(param);

    expect(mockAsk).toHaveBeenCalledTimes(1);
    expect(mockAskAgent).toHaveBeenCalledTimes(1);
    expect(mockUpdateComment).not.toHaveBeenCalled();
    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);
    expect(results[0].executed).toBe(false);
  });

  it('does not update comment when askAgent returns empty translatedText', async () => {
    mockAsk.mockResolvedValueOnce('must_translate');
    mockAskAgent.mockResolvedValueOnce({ translatedText: '   ' });
    const param = baseParam();

    const results = await useCase.invoke(param);

    expect(mockAsk).toHaveBeenCalledTimes(1);
    expect(mockAskAgent).toHaveBeenCalledTimes(1);
    expect(mockUpdateComment).not.toHaveBeenCalled();
    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);
    expect(results[0].executed).toBe(false);
  });

  it('does not update comment when askAgent returns translatedText missing', async () => {
    mockAsk.mockResolvedValueOnce('must_translate');
    mockAskAgent.mockResolvedValueOnce({ reason: 'Ambiguous input' });
    const param = baseParam();

    const results = await useCase.invoke(param);

    expect(mockAskAgent).toHaveBeenCalledTimes(1);
    expect(mockUpdateComment).not.toHaveBeenCalled();
    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);
    expect(results[0].executed).toBe(false);
  });
});
