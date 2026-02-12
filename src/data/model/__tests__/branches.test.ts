import * as github from '@actions/github';
import { Branches } from '../branches';

jest.mock('@actions/github', () => ({
  context: {
    payload: {} as Record<string, unknown>,
  },
}));

describe('Branches', () => {
  it('assigns tree names from constructor', () => {
    const b = new Branches(
      'main',
      'develop',
      'feature',
      'bugfix',
      'hotfix',
      'release',
      'docs',
      'chore'
    );
    expect(b.main).toBe('main');
    expect(b.development).toBe('develop');
    expect(b.featureTree).toBe('feature');
    expect(b.bugfixTree).toBe('bugfix');
    expect(b.hotfixTree).toBe('hotfix');
    expect(b.releaseTree).toBe('release');
    expect(b.docsTree).toBe('docs');
    expect(b.choreTree).toBe('chore');
  });

  it('defaultBranch returns repository.default_branch from context', () => {
    (github.context as { payload: Record<string, unknown> }).payload = {
      repository: { default_branch: 'main' },
    };
    const b = new Branches('main', 'develop', 'feature', 'bugfix', 'hotfix', 'release', 'docs', 'chore');
    expect(b.defaultBranch).toBe('main');
  });

  it('defaultBranch returns empty string when repository missing', () => {
    (github.context as { payload: Record<string, unknown> }).payload = {};
    const b = new Branches('main', 'develop', 'feature', 'bugfix', 'hotfix', 'release', 'docs', 'chore');
    expect(b.defaultBranch).toBe('');
  });
});
