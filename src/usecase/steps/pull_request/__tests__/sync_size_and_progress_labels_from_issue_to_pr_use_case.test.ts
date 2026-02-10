import { SyncSizeAndProgressLabelsFromIssueToPrUseCase } from '../sync_size_and_progress_labels_from_issue_to_pr_use_case';

jest.mock('../../../../utils/logger', () => ({
  logInfo: jest.fn(),
  logDebugInfo: jest.fn(),
  logError: jest.fn(),
}));

const mockGetLabels = jest.fn();
const mockSetLabels = jest.fn();

jest.mock('../../../../data/repository/issue_repository', () => ({
  IssueRepository: jest.fn().mockImplementation(() => ({
    getLabels: mockGetLabels,
    setLabels: mockSetLabels,
  })),
  PROGRESS_LABEL_PATTERN: /^\d+%$/,
}));

const defaultSizeLabels = ['size: XS', 'size: S', 'size: M', 'size: L', 'size: XL', 'size: XXL'];

function baseParam(overrides: Record<string, unknown> = {}) {
  return {
    owner: 'o',
    repo: 'r',
    tokens: { token: 't' },
    issueNumber: 287,
    pullRequest: { number: 100 },
    labels: { sizeLabels: defaultSizeLabels },
    ...overrides,
  } as unknown as Parameters<SyncSizeAndProgressLabelsFromIssueToPrUseCase['invoke']>[0];
}

describe('SyncSizeAndProgressLabelsFromIssueToPrUseCase', () => {
  let useCase: SyncSizeAndProgressLabelsFromIssueToPrUseCase;

  beforeEach(() => {
    useCase = new SyncSizeAndProgressLabelsFromIssueToPrUseCase();
    mockGetLabels.mockReset();
    mockSetLabels.mockReset();
  });

  it('returns executed false when no issue linked', async () => {
    const param = baseParam({ issueNumber: -1 });

    const results = await useCase.invoke(param);

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);
    expect(results[0].executed).toBe(false);
    expect(results[0].steps).toContain('No issue linked; size/progress labels not synced.');
    expect(mockGetLabels).not.toHaveBeenCalled();
  });

  it('returns executed true with no sync when issue has no size or progress labels', async () => {
    mockGetLabels.mockResolvedValue(['bug', 'feature']);
    const param = baseParam();

    const results = await useCase.invoke(param);

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);
    expect(results[0].executed).toBe(true);
    expect(results[0].steps).toContain('Issue has no size/progress labels to sync.');
    expect(mockSetLabels).not.toHaveBeenCalled();
  });

  it('copies only progress label and step says "Progress label(s) copied"', async () => {
    mockGetLabels
      .mockResolvedValueOnce(['bug', '50%'])
      .mockResolvedValueOnce(['bug']);
    mockSetLabels.mockResolvedValue(undefined);
    const param = baseParam({ issueNumber: 287, pullRequest: { number: 100 } });

    const results = await useCase.invoke(param);

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);
    expect(results[0].executed).toBe(true);
    expect(results[0].steps).toContain(
      'Progress label(s) copied from issue #287 to this PR (50%).'
    );
    expect(results[0].steps).not.toContain(
      'Size and progress labels copied from issue #287 to this PR.'
    );
    expect(mockSetLabels).toHaveBeenCalledWith(
      'o',
      'r',
      100,
      expect.arrayContaining(['bug', '50%']),
      't'
    );
  });

  it('copies only size label and step says "Size label(s) copied"', async () => {
    mockGetLabels
      .mockResolvedValueOnce(['bug', 'size: M'])
      .mockResolvedValueOnce(['bug']);
    mockSetLabels.mockResolvedValue(undefined);
    const param = baseParam();

    const results = await useCase.invoke(param);

    expect(results).toHaveLength(1);
    expect(results[0].steps).toContain(
      'Size label(s) copied from issue #287 to this PR (size: M).'
    );
    expect(results[0].steps).not.toContain('Progress label(s) copied');
    expect(mockSetLabels).toHaveBeenCalledWith(
      'o',
      'r',
      100,
      expect.arrayContaining(['bug', 'size: M']),
      't'
    );
  });

  it('copies both size and progress and step says "Size and progress labels copied"', async () => {
    mockGetLabels
      .mockResolvedValueOnce(['bug', 'size: M', '50%'])
      .mockResolvedValueOnce(['bug']);
    mockSetLabels.mockResolvedValue(undefined);
    const param = baseParam();

    const results = await useCase.invoke(param);

    expect(results).toHaveLength(1);
    expect(results[0].steps).toContain(
      'Size and progress labels copied from issue #287 to this PR (size: M, 50%).'
    );
    expect(mockSetLabels).toHaveBeenCalledWith(
      'o',
      'r',
      100,
      expect.arrayContaining(['bug', 'size: M', '50%']),
      't'
    );
  });

  it('returns failure when setLabels throws', async () => {
    mockGetLabels
      .mockResolvedValueOnce(['50%'])
      .mockResolvedValueOnce([]);
    mockSetLabels.mockRejectedValue(new Error('API error'));
    const param = baseParam();

    const results = await useCase.invoke(param);

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
    expect(results[0].steps).toContain('Failed to sync size/progress labels from issue to PR.');
  });
});
