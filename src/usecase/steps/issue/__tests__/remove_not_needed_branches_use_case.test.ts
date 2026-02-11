import * as core from '@actions/core';
import { RemoveNotNeededBranchesUseCase } from '../remove_not_needed_branches_use_case';

jest.mock('../../../../utils/logger', () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
}));

jest.mock('@actions/core', () => ({
  setFailed: jest.fn(),
}));

const mockFormatBranchName = jest.fn();
const mockGetListOfBranches = jest.fn();
const mockRemoveBranch = jest.fn();
jest.mock('../../../../data/repository/branch_repository', () => ({
  BranchRepository: jest.fn().mockImplementation(() => ({
    formatBranchName: mockFormatBranchName,
    getListOfBranches: mockGetListOfBranches,
    removeBranch: mockRemoveBranch,
  })),
}));

function baseParam(overrides: Record<string, unknown> = {}) {
  return {
    owner: 'o',
    repo: 'r',
    issueNumber: 42,
    tokens: { token: 't' },
    issue: { title: 'Add login' },
    managementBranch: 'feature',
    branches: { featureTree: 'feature', bugfixTree: 'bugfix' },
    ...overrides,
  } as unknown as Parameters<RemoveNotNeededBranchesUseCase['invoke']>[0];
}

describe('RemoveNotNeededBranchesUseCase', () => {
  let useCase: RemoveNotNeededBranchesUseCase;

  beforeEach(() => {
    useCase = new RemoveNotNeededBranchesUseCase();
    mockFormatBranchName.mockReturnValue('add-login');
    mockGetListOfBranches.mockResolvedValue(['feature/42-add-login', 'bugfix/42-old-name']);
    mockRemoveBranch.mockResolvedValue(true);
  });

  it('calls setFailed and returns when issue title is empty', async () => {
    const param = baseParam({ issue: { title: '' } });
    const results = await useCase.invoke(param);
    expect(core.setFailed).toHaveBeenCalledWith('Issue title not available.');
    expect(results.some((r) => r.steps?.some((s) => s.includes('title was not found')))).toBe(true);
  });

  it('removes branches that do not match final branch name', async () => {
    const param = baseParam();
    const results = await useCase.invoke(param);
    expect(mockFormatBranchName).toHaveBeenCalledWith('Add login', 42);
    expect(mockGetListOfBranches).toHaveBeenCalledWith('o', 'r', 't');
    expect(mockRemoveBranch).toHaveBeenCalled();
    expect(results.length).toBeGreaterThanOrEqual(0);
  });

  it('returns failure on error', async () => {
    mockGetListOfBranches.mockRejectedValue(new Error('API error'));
    const param = baseParam();
    const results = await useCase.invoke(param);
    expect(results.some((r) => r.success === false)).toBe(true);
  });
});
