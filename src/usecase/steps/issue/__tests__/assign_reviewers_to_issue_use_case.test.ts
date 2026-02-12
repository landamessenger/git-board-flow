import { AssignReviewersToIssueUseCase } from '../assign_reviewers_to_issue_use_case';

jest.mock('../../../../utils/logger', () => ({
  logInfo: jest.fn(),
  logDebugInfo: jest.fn(),
  logError: jest.fn(),
}));

const mockGetCurrentReviewers = jest.fn();
const mockGetCurrentAssignees = jest.fn();
const mockGetRandomMembers = jest.fn();
const mockAddReviewersToPullRequest = jest.fn();

jest.mock('../../../../data/repository/pull_request_repository', () => ({
  PullRequestRepository: jest.fn().mockImplementation(() => ({
    getCurrentReviewers: mockGetCurrentReviewers,
    addReviewersToPullRequest: mockAddReviewersToPullRequest,
  })),
}));
jest.mock('../../../../data/repository/issue_repository', () => ({
  IssueRepository: jest.fn().mockImplementation(() => ({
    getCurrentAssignees: mockGetCurrentAssignees,
  })),
}));
jest.mock('../../../../data/repository/project_repository', () => ({
  ProjectRepository: jest.fn().mockImplementation(() => ({
    getRandomMembers: mockGetRandomMembers,
  })),
}));

function baseParam(overrides: Record<string, unknown> = {}) {
  return {
    owner: 'o',
    repo: 'r',
    tokens: { token: 't' },
    pullRequest: {
      number: 42,
      desiredReviewersCount: 1,
      creator: 'author',
    },
    ...overrides,
  } as unknown as Parameters<AssignReviewersToIssueUseCase['invoke']>[0];
}

describe('AssignReviewersToIssueUseCase', () => {
  let useCase: AssignReviewersToIssueUseCase;

  beforeEach(() => {
    useCase = new AssignReviewersToIssueUseCase();
    mockGetCurrentReviewers.mockReset();
    mockGetCurrentAssignees.mockReset();
    mockGetRandomMembers.mockReset();
    mockAddReviewersToPullRequest.mockReset();
    mockGetCurrentAssignees.mockResolvedValue([]);
  });

  it('returns success with no steps when current reviewers already meet desired count', async () => {
    mockGetCurrentReviewers.mockResolvedValue(['elisalopez']);
    const param = baseParam({ pullRequest: { number: 42, desiredReviewersCount: 1, creator: 'author' } });

    const results = await useCase.invoke(param);

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);
    expect(results[0].executed).toBe(true);
    expect(results[0].steps).toEqual([]);
    expect(mockAddReviewersToPullRequest).not.toHaveBeenCalled();
  });

  it('returns success with no steps when reviewer already submitted (counted in currentReviewers)', async () => {
    mockGetCurrentReviewers.mockResolvedValue(['elisalopez']);
    const param = baseParam({ pullRequest: { number: 42, desiredReviewersCount: 1, creator: 'author' } });

    const results = await useCase.invoke(param);

    expect(results).toHaveLength(1);
    expect(results[0].steps).toEqual([]);
    expect(mockGetRandomMembers).not.toHaveBeenCalled();
    expect(mockAddReviewersToPullRequest).not.toHaveBeenCalled();
  });

  it('requests new reviewers and adds step only for newly added when under desired count', async () => {
    mockGetCurrentReviewers.mockResolvedValue([]);
    mockGetRandomMembers.mockResolvedValue(['newreviewer']);
    mockAddReviewersToPullRequest.mockResolvedValue(['newreviewer']);
    const param = baseParam({ pullRequest: { number: 42, desiredReviewersCount: 1, creator: 'author' } });

    const results = await useCase.invoke(param);

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);
    expect(results[0].executed).toBe(true);
    expect(results[0].steps).toContain('@newreviewer was requested to review the pull request.');
    expect(mockAddReviewersToPullRequest).toHaveBeenCalledWith('o', 'r', 42, ['newreviewer'], 't');
  });

  it('excludes creator and current reviewers/assignees when requesting members', async () => {
    mockGetCurrentReviewers.mockResolvedValue(['reviewer1']);
    mockGetRandomMembers.mockResolvedValue(['reviewer2']);
    mockAddReviewersToPullRequest.mockResolvedValue(['reviewer2']);
    const param = baseParam({
      pullRequest: { number: 42, desiredReviewersCount: 2, creator: 'author' },
    });
    mockGetCurrentAssignees.mockResolvedValue(['assignee1']);

    await useCase.invoke(param);

    expect(mockGetRandomMembers).toHaveBeenCalledWith(
      'o',
      1,
      expect.arrayContaining(['author', 'reviewer1', 'assignee1']),
      't'
    );
  });

  it('returns failure when no members available to assign as reviewers', async () => {
    mockGetCurrentReviewers.mockResolvedValue([]);
    mockGetRandomMembers.mockResolvedValue([]);
    const param = baseParam();

    const results = await useCase.invoke(param);

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
    expect(results[0].steps).toContain(
      'Tried to assign members as reviewers to pull request, but no one was found.'
    );
    expect(mockAddReviewersToPullRequest).not.toHaveBeenCalled();
  });

  it('returns failure when getCurrentReviewers throws', async () => {
    mockGetCurrentReviewers.mockRejectedValue(new Error('API error'));
    const param = baseParam();

    const results = await useCase.invoke(param);

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
    expect(results[0].steps).toContain('Tried to assign members to issue.');
  });

  it('adds step only for reviewers that are in the requested members list', async () => {
    mockGetCurrentReviewers.mockResolvedValue([]);
    mockGetRandomMembers.mockResolvedValue(['requested']);
    mockAddReviewersToPullRequest.mockResolvedValue(['requested', 'other']);
    const param = baseParam({ pullRequest: { number: 42, desiredReviewersCount: 1, creator: 'author' } });

    const results = await useCase.invoke(param);

    expect(results.filter((r) => r.steps?.some((s) => s.includes('was requested to review')))).toHaveLength(1);
    expect(results[0].steps).toContain('@requested was requested to review the pull request.');
  });
});
