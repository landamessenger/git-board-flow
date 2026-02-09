import { GetReleaseVersionUseCase } from '../get_release_version_use_case';
import { Result } from '../../../../data/model/result';

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

describe('GetReleaseVersionUseCase', () => {
  let useCase: GetReleaseVersionUseCase;

  beforeEach(() => {
    useCase = new GetReleaseVersionUseCase();
    mockGetDescription.mockReset();
  });

  it('returns success with releaseVersion when description contains Release Version', async () => {
    mockGetDescription.mockResolvedValue('Issue body\n### Release Version 2.0.0\nMore text');
    const param = {
      isSingleAction: true,
      isIssue: false,
      isPullRequest: false,
      singleAction: { issue: 42 },
      issue: { number: 0 },
      pullRequest: { number: 0 },
      owner: 'owner',
      repo: 'repo',
      tokens: { token: 'token' },
    } as unknown as Parameters<GetReleaseVersionUseCase['invoke']>[0];

    const results = await useCase.invoke(param);

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);
    expect(results[0].payload?.releaseVersion).toBe('2.0.0');
    expect(mockGetDescription).toHaveBeenCalledWith('owner', 'repo', 42, 'token');
  });

  it('returns failure when description is undefined', async () => {
    mockGetDescription.mockResolvedValue(undefined);
    const param = {
      isSingleAction: true,
      isIssue: false,
      isPullRequest: false,
      singleAction: { issue: 1 },
      owner: 'o',
      repo: 'r',
      tokens: { token: 't' },
    } as unknown as Parameters<GetReleaseVersionUseCase['invoke']>[0];

    const results = await useCase.invoke(param);

    expect(results[0].success).toBe(false);
    expect(results[0].steps?.some((s) => s.includes('description'))).toBe(true);
  });

  it('returns failure when issue number cannot be determined', async () => {
    const param = {
      isSingleAction: false,
      isIssue: false,
      isPullRequest: false,
      singleAction: { issue: 0 },
      issue: { number: -1 },
      pullRequest: { number: 0 },
      owner: 'o',
      repo: 'r',
      tokens: { token: 't' },
    } as unknown as Parameters<GetReleaseVersionUseCase['invoke']>[0];

    const results = await useCase.invoke(param);

    expect(results[0].success).toBe(false);
    expect(results[0].steps?.some((s) => s.includes('identifying the issue'))).toBe(true);
    expect(mockGetDescription).not.toHaveBeenCalled();
  });
});
