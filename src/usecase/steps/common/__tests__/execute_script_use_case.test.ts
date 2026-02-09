import { CommitPrefixBuilderUseCase } from '../execute_script_use_case';

jest.mock('../../../../utils/logger', () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
  logDebugInfo: jest.fn(),
}));

describe('CommitPrefixBuilderUseCase (execute_script)', () => {
  let useCase: CommitPrefixBuilderUseCase;

  beforeEach(() => {
    useCase = new CommitPrefixBuilderUseCase();
  });

  const param = (branchName: string, commitPrefixBuilder: string) =>
    ({
      commitPrefixBuilderParams: { branchName },
      commitPrefixBuilder,
    } as unknown as Parameters<CommitPrefixBuilderUseCase['invoke']>[0]);

  it('returns success with scriptResult when transforms are applied', async () => {
    const results = await useCase.invoke(param('feature/123-add-login', 'replace-slash'));

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);
    expect(results[0].payload?.scriptResult).toBe('feature-123-add-login');
  });

  it('applies multiple transforms in order', async () => {
    const results = await useCase.invoke(param('Feature/Branch_Name', 'replace-slash,kebab-case'));

    expect(results[0].payload?.scriptResult).toBe('feature-branch-name');
  });

  it('applies lowercase transform', async () => {
    const results = await useCase.invoke(param('FEATURE/ABC', 'replace-slash,lowercase'));

    expect(results[0].payload?.scriptResult).toBe('feature-abc');
  });

  it('applies uppercase transform', async () => {
    const results = await useCase.invoke(param('feature/abc', 'replace-slash,uppercase'));

    expect(results[0].payload?.scriptResult).toBe('FEATURE-ABC');
  });

  it('applies kebab-case transform', async () => {
    const results = await useCase.invoke(param('Feature Branch Name', 'kebab-case'));

    expect(results[0].payload?.scriptResult).toBe('feature-branch-name');
  });

  it('applies snake_case transform', async () => {
    const results = await useCase.invoke(param('Feature Branch', 'snake-case'));

    expect(results[0].payload?.scriptResult).toBe('feature_branch');
  });

  it('applies trim transform', async () => {
    const results = await useCase.invoke(param('  branch  ', 'trim'));

    expect(results[0].payload?.scriptResult).toBe('branch');
  });

  it('applies replace-all transform', async () => {
    const results = await useCase.invoke(param('feature/branch_name', 'replace-all'));

    expect(results[0].payload?.scriptResult).toBe('feature-branch-name');
  });

  it('returns failure when branchName is missing and throws', async () => {
    const results = await useCase.invoke(
      param(undefined as unknown as string, 'lowercase')
    );

    expect(results[0].success).toBe(false);
    expect(results[0].executed).toBe(true);
  });
});
