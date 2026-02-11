import * as core from '@actions/core';
import { PrepareBranchesUseCase } from '../prepare_branches_use_case';

jest.mock('../../../../utils/logger', () => ({
  logInfo: jest.fn(),
  logDebugInfo: jest.fn(),
  logError: jest.fn(),
}));

jest.mock('@actions/core', () => ({
  setFailed: jest.fn(),
}));

const mockFetchRemoteBranches = jest.fn();
const mockGetListOfBranches = jest.fn();
const mockManageBranches = jest.fn();
jest.mock('../../../../data/repository/branch_repository', () => ({
  BranchRepository: jest.fn().mockImplementation(() => ({
    fetchRemoteBranches: mockFetchRemoteBranches,
    getListOfBranches: mockGetListOfBranches,
    manageBranches: mockManageBranches,
  })),
}));

const mockMoveIssueToColumn = jest.fn();
jest.mock('../../../../data/repository/project_repository', () => ({
  ProjectRepository: jest.fn().mockImplementation(() => ({
    moveIssueToColumn: mockMoveIssueToColumn,
  })),
}));

function baseParam(overrides: Record<string, unknown> = {}) {
  return {
    owner: 'o',
    repo: 'r',
    issueNumber: 42,
    tokens: { token: 't' },
    issue: { title: 'Add login feature' },
    labels: { isMandatoryBranchedLabel: true },
    managementBranch: 'feature',
    branches: {
      development: 'develop',
      defaultBranch: 'main',
      featureTree: 'feature',
      bugfixTree: 'bugfix',
      hotfixTree: 'hotfix',
      main: 'main',
    },
    release: { active: false },
    hotfix: { active: false },
    commitPrefixBuilder: '',
    currentConfiguration: {},
    project: { getProjects: () => [], getProjectColumnIssueInProgress: () => '' },
    ...overrides,
  } as unknown as Parameters<PrepareBranchesUseCase['invoke']>[0];
}

describe('PrepareBranchesUseCase', () => {
  let useCase: PrepareBranchesUseCase;

  beforeEach(() => {
    jest.useFakeTimers();
    useCase = new PrepareBranchesUseCase();
    mockFetchRemoteBranches.mockResolvedValue(undefined);
    mockGetListOfBranches.mockResolvedValue(['develop', 'main']);
    mockMoveIssueToColumn.mockResolvedValue(true);
    mockManageBranches.mockResolvedValue([
      {
        id: 'PrepareBranchesUseCase',
        success: true,
        executed: true,
        payload: {
          newBranchName: 'feature/42-add-login-feature',
          newBranchUrl: 'https://github.com/o/r/tree/feature/42-add-login-feature',
          baseBranchName: 'develop',
          baseBranchUrl: 'https://github.com/o/r/tree/develop',
        },
      },
    ]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns failure when issue title is empty and not mandatory branched label', async () => {
    const param = baseParam({
      issue: { title: '' },
      labels: { isMandatoryBranchedLabel: false },
    });
    const results = await useCase.invoke(param);
    expect(core.setFailed).toHaveBeenCalledWith('Issue title not available.');
    expect(results.some((r) => r.success === false)).toBe(true);
  });

  it('fetches remote branches and gets list of branches', async () => {
    const param = baseParam();
    const promise = useCase.invoke(param);
    await jest.advanceTimersByTimeAsync(10000);
    await promise;
    expect(mockFetchRemoteBranches).toHaveBeenCalled();
    expect(mockGetListOfBranches).toHaveBeenCalledWith('o', 'r', 't');
  });

  it('calls manageBranches and returns results when not release/hotfix', async () => {
    const param = baseParam();
    const promise = useCase.invoke(param);
    await jest.advanceTimersByTimeAsync(10000);
    const results = await promise;
    expect(mockManageBranches).toHaveBeenCalled();
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.success === true)).toBe(true);
  });
});
