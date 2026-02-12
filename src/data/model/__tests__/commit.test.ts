import * as github from '@actions/github';
import { Commit } from '../commit';

jest.mock('@actions/github', () => ({
  context: {
    payload: {} as Record<string, unknown>,
  },
}));

describe('Commit', () => {
  beforeEach(() => {
    (github.context as { payload: Record<string, unknown> }).payload = {};
  });

  it('uses inputs when provided for branchReference and branch', () => {
    const inputs = { commits: { ref: 'refs/heads/feature/123-x' } };
    const c = new Commit(inputs);
    expect(c.branchReference).toBe('refs/heads/feature/123-x');
    expect(c.branch).toBe('feature/123-x');
  });

  it('falls back to context.payload.ref when inputs have no commits.ref', () => {
    (github.context as { payload: Record<string, unknown> }).payload = { ref: 'refs/heads/main' };
    const c = new Commit(undefined);
    expect(c.branchReference).toBe('refs/heads/main');
    expect(c.branch).toBe('main');
  });

  it('returns empty string for branchReference when no inputs and no context ref', () => {
    const c = new Commit(undefined);
    expect(c.branchReference).toBe('');
    expect(c.branch).toBe('');
  });

  it('returns commits from context.payload when no inputs', () => {
    const payloadCommits = [{ id: '1', message: 'fix' }];
    (github.context as { payload: Record<string, unknown> }).payload = { commits: payloadCommits };
    const c = new Commit(undefined);
    expect(c.commits).toEqual(payloadCommits);
  });

  it('returns empty array when context has no commits', () => {
    const c = new Commit(undefined);
    expect(c.commits).toEqual([]);
  });
});
