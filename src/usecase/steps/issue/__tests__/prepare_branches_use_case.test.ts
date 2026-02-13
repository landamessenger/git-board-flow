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
const mockGetCommitTag = jest.fn();
const mockCreateLinkedBranch = jest.fn();
jest.mock('../../../../data/repository/branch_repository', () => ({
  BranchRepository: jest.fn().mockImplementation(() => ({
    fetchRemoteBranches: mockFetchRemoteBranches,
    getListOfBranches: mockGetListOfBranches,
    manageBranches: mockManageBranches,
    getCommitTag: mockGetCommitTag,
    createLinkedBranch: mockCreateLinkedBranch,
  })),
}));

const mockMoveIssueToColumn = jest.fn();
jest.mock('../../../../data/repository/project_repository', () => ({
  ProjectRepository: jest.fn().mockImplementation(() => ({
    moveIssueToColumn: mockMoveIssueToColumn,
  })),
}));

const mockMoveIssueInvoke = jest.fn();
jest.mock('../move_issue_to_in_progress', () => ({
  MoveIssueToInProgressUseCase: jest.fn().mockImplementation(() => ({
    invoke: mockMoveIssueInvoke,
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
    jest.clearAllMocks();
    mockFetchRemoteBranches.mockResolvedValue(undefined);
    mockGetListOfBranches.mockResolvedValue(['develop', 'main']);
    mockMoveIssueToColumn.mockResolvedValue(true);
    mockGetCommitTag.mockResolvedValue('abc123');
    mockCreateLinkedBranch.mockResolvedValue([
      { success: true, executed: true, payload: {} },
    ]);
    mockMoveIssueInvoke.mockResolvedValue([]);
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

  it('hotfix path: creates linked branch when hotfix branch not in list', async () => {
    mockGetListOfBranches.mockResolvedValue(['develop', 'main']);
    mockGetCommitTag.mockResolvedValue('oid123');
    mockCreateLinkedBranch.mockResolvedValue([
      { success: true, executed: true },
    ]);
    const param = baseParam({
      hotfix: {
        active: true,
        baseVersion: '1.0.0',
        version: '1.0.1',
        branch: 'hotfix/1.0.1',
        baseBranch: 'tags/v1.0.0',
      },
      currentConfiguration: {},
    });
    const promise = useCase.invoke(param);
    await jest.advanceTimersByTimeAsync(10000);
    const results = await promise;
    expect(mockCreateLinkedBranch).toHaveBeenCalledWith(
      'o',
      'r',
      'tags/v1.0.0',
      'hotfix/1.0.1',
      42,
      'oid123',
      't',
    );
    expect(results.some((r) => r.success === true && r.steps?.some((s) => s.includes('tag')))).toBe(true);
  });

  it('hotfix path: branch already exists returns step', async () => {
    mockGetListOfBranches.mockResolvedValue(['develop', 'main', 'hotfix/1.0.1']);
    mockGetCommitTag.mockResolvedValue('oid123');
    const param = baseParam({
      hotfix: {
        active: true,
        baseVersion: '1.0.0',
        version: '1.0.1',
        branch: 'hotfix/1.0.1',
        baseBranch: 'tags/v1.0.0',
      },
      currentConfiguration: {},
    });
    const promise = useCase.invoke(param);
    await jest.advanceTimersByTimeAsync(10000);
    const results = await promise;
    expect(mockCreateLinkedBranch).not.toHaveBeenCalled();
    expect(results.some((r) => r.steps?.some((s) => s.includes('already exists')))).toBe(true);
  });

  it('hotfix path: no tag found returns failure', async () => {
    mockGetListOfBranches.mockResolvedValue(['develop']);
    const param = baseParam({
      hotfix: {
        active: true,
        baseVersion: undefined,
        version: undefined,
        branch: undefined,
        baseBranch: undefined,
      },
      currentConfiguration: {},
    });
    const promise = useCase.invoke(param);
    await jest.advanceTimersByTimeAsync(0);
    const results = await promise;
    expect(results.some((r) => r.success === false && r.steps?.some((s) => s.includes('no tag')))).toBe(true);
  });

  it('release path: creates linked branch when release branch not in list', async () => {
    mockGetListOfBranches.mockResolvedValue(['develop', 'main']);
    mockCreateLinkedBranch.mockResolvedValue([
      {
        success: true,
        executed: true,
        payload: { newBranchName: 'release/2.0.0', newBranchUrl: 'https://github.com/o/r/tree/release/2.0.0' },
      },
    ]);
    const param = baseParam({
      release: { active: true, version: '2.0.0', branch: 'release/2.0.0' },
      labels: { deploy: 'deploy' },
      workflows: { release: 'release-wf' },
      currentConfiguration: {},
    });
    const promise = useCase.invoke(param);
    await jest.advanceTimersByTimeAsync(0);
    const results = await promise;
    expect(mockCreateLinkedBranch).toHaveBeenCalledWith(
      'o',
      'r',
      'develop',
      'release/2.0.0',
      42,
      undefined,
      't',
    );
    expect(results.some((r) => r.success === true)).toBe(true);
  });

  it('release path: branch already exists returns reminders', async () => {
    mockGetListOfBranches.mockResolvedValue(['develop', 'main', 'release/2.0.0']);
    const param = baseParam({
      release: { active: true, version: '2.0.0', branch: 'release/2.0.0' },
      currentConfiguration: {},
    });
    const promise = useCase.invoke(param);
    await jest.advanceTimersByTimeAsync(10000);
    const results = await promise;
    expect(mockCreateLinkedBranch).not.toHaveBeenCalled();
    expect(results.some((r) => r.reminders?.length)).toBe(true);
  });

  it('release path: no release version returns failure', async () => {
    mockGetListOfBranches.mockResolvedValue(['develop']);
    const param = baseParam({
      release: { active: true, version: undefined, branch: undefined },
      currentConfiguration: {},
    });
    const promise = useCase.invoke(param);
    await jest.advanceTimersByTimeAsync(0);
    const results = await promise;
    expect(results.some((r) => r.success === false && r.steps?.some((s) => s.includes('release version')))).toBe(true);
  });

  it('calls MoveIssueToInProgressUseCase when manageBranches last action success and executed', async () => {
    const param = baseParam();
    const promise = useCase.invoke(param);
    await jest.advanceTimersByTimeAsync(10000);
    await promise;
    expect(mockMoveIssueInvoke).toHaveBeenCalledWith(param);
  });
});
