import { CheckPriorityPullRequestSizeUseCase } from '../check_priority_pull_request_size_use_case';

jest.mock('../../../../utils/logger', () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
  logDebugInfo: jest.fn(),
}));

const mockSetTaskPriority = jest.fn();
jest.mock('../../../../data/repository/project_repository', () => ({
  ProjectRepository: jest.fn().mockImplementation(() => ({
    setTaskPriority: mockSetTaskPriority,
  })),
}));

function baseParam(overrides: Record<string, unknown> = {}) {
  return {
    owner: 'o',
    repo: 'r',
    pullRequest: { number: 2 },
    tokens: { token: 't' },
    labels: {
      priorityLabelOnIssue: 'P1',
      priorityLabelOnIssueProcessable: true,
      priorityHigh: 'P0',
      priorityMedium: 'P1',
      priorityLow: 'P2',
    },
    project: { getProjects: () => [{ id: 'p1', title: 'Board' }] },
    ...overrides,
  } as unknown as Parameters<CheckPriorityPullRequestSizeUseCase['invoke']>[0];
}

describe('CheckPriorityPullRequestSizeUseCase', () => {
  let useCase: CheckPriorityPullRequestSizeUseCase;

  beforeEach(() => {
    useCase = new CheckPriorityPullRequestSizeUseCase();
    mockSetTaskPriority.mockReset();
  });

  it('returns success executed false when no projects', async () => {
    const param = baseParam({ project: { getProjects: () => [] } });

    const results = await useCase.invoke(param);

    expect(results[0].success).toBe(true);
    expect(results[0].executed).toBe(false);
    expect(mockSetTaskPriority).not.toHaveBeenCalled();
  });

  it('returns success executed false when priority not high/medium/low', async () => {
    const param = baseParam({
      labels: {
        priorityLabelOnIssue: 'other',
        priorityLabelOnIssueProcessable: true,
        priorityHigh: 'P0',
        priorityMedium: 'P1',
        priorityLow: 'P2',
      },
    });

    const results = await useCase.invoke(param);

    expect(results[0].executed).toBe(false);
  });

  it('calls setTaskPriority when priority is P1', async () => {
    mockSetTaskPriority.mockResolvedValue(true);
    const param = baseParam();

    const results = await useCase.invoke(param);

    expect(results[0].success).toBe(true);
    expect(results[0].executed).toBe(true);
    expect(mockSetTaskPriority).toHaveBeenCalled();
  });
});
