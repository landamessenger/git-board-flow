import { InitialSetupUseCase } from '../initial_setup_use_case';
import { Result } from '../../../data/model/result';
import type { Execution } from '../../../data/model/execution';

jest.mock('../../../utils/logger', () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
}));

jest.mock('../../../utils/task_emoji', () => ({
  getTaskEmoji: jest.fn(() => '📋'),
}));

const mockEnsureGitHubDirs = jest.fn();
const mockCopySetupFiles = jest.fn();
jest.mock('../../../utils/setup_files', () => ({
  ensureGitHubDirs: (...args: unknown[]) => mockEnsureGitHubDirs(...args),
  copySetupFiles: (...args: unknown[]) => mockCopySetupFiles(...args),
}));

const mockGetUserFromToken = jest.fn();
jest.mock('../../../data/repository/project_repository', () => ({
  ProjectRepository: jest.fn().mockImplementation(() => ({
    getUserFromToken: mockGetUserFromToken,
  })),
}));

const mockEnsureLabels = jest.fn();
const mockEnsureProgressLabels = jest.fn();
const mockEnsureIssueTypes = jest.fn();
jest.mock('../../../data/repository/issue_repository', () => ({
  IssueRepository: jest.fn().mockImplementation(() => ({
    ensureLabels: mockEnsureLabels,
    ensureProgressLabels: mockEnsureProgressLabels,
    ensureIssueTypes: mockEnsureIssueTypes,
  })),
}));

function baseParam(overrides: Record<string, unknown> = {}): Execution {
  return {
    owner: 'owner',
    repo: 'repo',
    tokens: { token: 'token' },
    labels: {},
    issueTypes: {},
    singleAction: {},
    currentConfiguration: {},
    branches: {},
    release: {},
    hotfix: {},
    issue: {},
    pullRequest: {},
    workflows: {},
    project: { getProjects: () => [], getProjectColumnIssueCreated: () => '', getProjectColumnIssueInProgress: () => '' },
    commit: {},
    commitPrefixBuilder: '',
    emoji: {},
    images: {},
    ai: {},
    locale: {},
    sizeThresholds: {},
    ...overrides,
  } as unknown as Execution;
}

describe('InitialSetupUseCase', () => {
  let useCase: InitialSetupUseCase;

  beforeEach(() => {
    useCase = new InitialSetupUseCase();
    mockEnsureGitHubDirs.mockClear();
    mockCopySetupFiles.mockReturnValue({ copied: 2, skipped: 0 });
    mockGetUserFromToken.mockResolvedValue('test-user');
    mockEnsureLabels.mockResolvedValue({ success: true, created: 0, existing: 5, errors: [] });
    mockEnsureProgressLabels.mockResolvedValue({ created: 0, existing: 21, errors: [] });
    mockEnsureIssueTypes.mockResolvedValue({ success: true, created: 0, existing: 3, errors: [] });
  });

  it('calls ensureGitHubDirs and copySetupFiles with process.cwd()', async () => {
    const param = baseParam();
    await useCase.invoke(param);
    expect(mockEnsureGitHubDirs).toHaveBeenCalledWith(process.cwd());
    expect(mockCopySetupFiles).toHaveBeenCalledWith(process.cwd());
  });

  it('returns success and steps including setup files when all steps succeed', async () => {
    const param = baseParam();
    const results = await useCase.invoke(param);
    expect(results).toHaveLength(1);
    expect(results[0]).toBeInstanceOf(Result);
    expect(results[0].success).toBe(true);
    expect(results[0].steps?.some((s) => s.includes('Setup files'))).toBe(true);
    expect(results[0].steps?.some((s) => s.includes('GitHub access verified'))).toBe(true);
    expect(results[0].steps?.some((s) => s.includes('Labels checked'))).toBe(true);
    expect(results[0].steps?.some((s) => s.includes('Progress labels'))).toBe(true);
    expect(results[0].steps?.some((s) => s.includes('Issue types'))).toBe(true);
  });

  it('returns failure when verifyGitHubAccess fails', async () => {
    mockGetUserFromToken.mockRejectedValue(new Error('Invalid token'));
    const param = baseParam();
    const results = await useCase.invoke(param);
    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
    expect(results[0].errors?.length).toBeGreaterThan(0);
  });

  it('continues and reports errors when ensureLabels fails', async () => {
    mockEnsureLabels.mockResolvedValue({ success: false, created: 0, existing: 0, errors: ['Label error'] });
    const param = baseParam();
    const results = await useCase.invoke(param);
    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
    expect(results[0].errors).toContain('Label error');
  });

  it('continues and reports errors when ensureProgressLabels has errors', async () => {
    mockEnsureProgressLabels.mockResolvedValue({ created: 0, existing: 0, errors: ['Progress error'] });
    const param = baseParam();
    const results = await useCase.invoke(param);
    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
    expect(results[0].errors).toContain('Progress error');
  });
});
