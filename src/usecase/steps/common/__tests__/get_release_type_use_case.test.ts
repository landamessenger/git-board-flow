import { GetReleaseTypeUseCase } from '../get_release_type_use_case';

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

describe('GetReleaseTypeUseCase', () => {
  let useCase: GetReleaseTypeUseCase;

  beforeEach(() => {
    useCase = new GetReleaseTypeUseCase();
    mockGetDescription.mockReset();
  });

  it('returns success with releaseType when description contains Release Type', async () => {
    mockGetDescription.mockResolvedValue('Body\n### Release Type Minor\n');
    const param = {
      isSingleAction: true,
      isIssue: false,
      isPullRequest: false,
      singleAction: { issue: 1 },
      owner: 'o',
      repo: 'r',
      tokens: { token: 't' },
    } as unknown as Parameters<GetReleaseTypeUseCase['invoke']>[0];

    const results = await useCase.invoke(param);

    expect(results[0].success).toBe(true);
    expect(results[0].payload?.releaseType).toBe('Minor');
  });

  it('returns failure when release type not found in description', async () => {
    mockGetDescription.mockResolvedValue('No release type here');
    const param = {
      isSingleAction: true,
      singleAction: { issue: 1 },
      owner: 'o',
      repo: 'r',
      tokens: { token: 't' },
    } as unknown as Parameters<GetReleaseTypeUseCase['invoke']>[0];

    const results = await useCase.invoke(param);

    expect(results[0].success).toBe(false);
  });

  it('returns failure when not single action, issue or pull request', async () => {
    const param = {
      isSingleAction: false,
      isIssue: false,
      isPullRequest: false,
      owner: 'o',
      repo: 'r',
      tokens: { token: 't' },
    } as unknown as Parameters<GetReleaseTypeUseCase['invoke']>[0];

    const results = await useCase.invoke(param);

    expect(results[0].success).toBe(false);
    expect(results[0].steps?.[0]).toContain('problem identifying the issue');
  });

  it('returns failure when getDescription returns undefined', async () => {
    mockGetDescription.mockResolvedValue(undefined);
    const param = {
      isSingleAction: true,
      singleAction: { issue: 1 },
      owner: 'o',
      repo: 'r',
      tokens: { token: 't' },
    } as unknown as Parameters<GetReleaseTypeUseCase['invoke']>[0];

    const results = await useCase.invoke(param);

    expect(results[0].success).toBe(false);
    expect(results[0].steps?.[0]).toContain('problem getting the description');
  });

  it('returns failure and pushes result on catch', async () => {
    mockGetDescription.mockRejectedValue(new Error('API error'));
    const param = {
      isSingleAction: true,
      singleAction: { issue: 1 },
      owner: 'o',
      repo: 'r',
      tokens: { token: 't' },
    } as unknown as Parameters<GetReleaseTypeUseCase['invoke']>[0];

    const results = await useCase.invoke(param);

    expect(results[0].success).toBe(false);
    expect(results[0].steps).toContain('Tried to check action permissions.');
  });
});
