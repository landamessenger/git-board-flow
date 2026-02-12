import { Projects } from '../projects';
import { ProjectDetail } from '../project_detail';

describe('Projects', () => {
  it('returns projects and column names from getters', () => {
    const details = [new ProjectDetail({ id: 'P1', title: 'Board' })];
    const p = new Projects(
      details,
      'To Do',
      'PR Open',
      'In Progress',
      'In Review'
    );
    expect(p.getProjects()).toEqual(details);
    expect(p.getProjectColumnIssueCreated()).toBe('To Do');
    expect(p.getProjectColumnPullRequestCreated()).toBe('PR Open');
    expect(p.getProjectColumnIssueInProgress()).toBe('In Progress');
    expect(p.getProjectColumnPullRequestInProgress()).toBe('In Review');
  });
});
