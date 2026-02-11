import { DeployAddedUseCase } from '../label_deploy_added_use_case';

jest.mock('../../../../utils/logger', () => ({
  logInfo: jest.fn(),
  logDebugInfo: jest.fn(),
  logError: jest.fn(),
}));

const mockMoveIssueToColumn = jest.fn();
jest.mock('../../../../data/repository/project_repository', () => ({
  ProjectRepository: jest.fn().mockImplementation(() => ({
    moveIssueToColumn: mockMoveIssueToColumn,
  })),
}));

const mockExecuteWorkflow = jest.fn();
jest.mock('../../../../data/repository/branch_repository', () => ({
  BranchRepository: jest.fn().mockImplementation(() => ({
    executeWorkflow: mockExecuteWorkflow,
  })),
}));

function baseParam(overrides: Record<string, unknown> = {}) {
  return {
    owner: 'o',
    repo: 'r',
    issueNumber: 42,
    tokens: { token: 't' },
    issue: {
      labeled: true,
      labelAdded: 'deploy',
      title: 'Add feature',
      body: '## Changelog\n- Item',
    },
    labels: { deploy: 'deploy' },
    release: { active: true, branch: 'release/1.0', version: '1.0.0' },
    hotfix: { active: false },
    workflows: { release: 'release.yml' },
    project: {
      getProjects: () => [],
      getProjectColumnIssueInProgress: () => 'In Progress',
    },
    ...overrides,
  } as unknown as Parameters<DeployAddedUseCase['invoke']>[0];
}

describe('DeployAddedUseCase (label_deploy_added)', () => {
  let useCase: DeployAddedUseCase;

  beforeEach(() => {
    useCase = new DeployAddedUseCase();
    mockMoveIssueToColumn.mockResolvedValue(true);
    mockExecuteWorkflow.mockResolvedValue(undefined);
  });

  it('returns executed false when labeled is false or labelAdded is not deploy', async () => {
    const param = baseParam({ issue: { labeled: false, labelAdded: '', title: '', body: '' } });
    const results = await useCase.invoke(param);
    expect(results.some((r) => r.executed === false)).toBe(true);
    expect(mockExecuteWorkflow).not.toHaveBeenCalled();
  });

  it('executes release workflow when release active and branch set', async () => {
    const param = baseParam();
    const results = await useCase.invoke(param);
    expect(mockExecuteWorkflow).toHaveBeenCalledWith(
      'o',
      'r',
      'release/1.0',
      'release.yml',
      expect.any(Object),
      't'
    );
    expect(results.some((r) => r.success && r.steps?.some((s) => s.includes('release')))).toBe(true);
  });

  it('returns failure when executeWorkflow throws', async () => {
    mockExecuteWorkflow.mockRejectedValue(new Error('Workflow error'));
    const param = baseParam();
    const results = await useCase.invoke(param);
    expect(results.some((r) => r.success === false)).toBe(true);
  });
});
