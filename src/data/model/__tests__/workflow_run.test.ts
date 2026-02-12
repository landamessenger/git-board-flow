import { WorkflowRun } from '../workflow_run';

describe('WorkflowRun', () => {
  const baseData = {
    id: 1,
    name: 'CI',
    head_branch: 'main',
    head_sha: 'abc',
    run_number: 1,
    event: 'push',
    status: 'completed',
    conclusion: 'success',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:01:00Z',
    url: 'https://api.github.com/...',
    html_url: 'https://github.com/...',
  };

  it('constructs with all fields', () => {
    const run = new WorkflowRun(baseData);
    expect(run.id).toBe(1);
    expect(run.name).toBe('CI');
    expect(run.head_branch).toBe('main');
    expect(run.head_sha).toBe('abc');
    expect(run.status).toBe('completed');
    expect(run.conclusion).toBe('success');
  });

  it('isActive returns true for in_progress', () => {
    const run = new WorkflowRun({ ...baseData, status: 'in_progress' });
    expect(run.isActive()).toBe(true);
  });

  it('isActive returns true for queued', () => {
    const run = new WorkflowRun({ ...baseData, status: 'queued' });
    expect(run.isActive()).toBe(true);
  });

  it('isActive returns false for completed', () => {
    const run = new WorkflowRun({ ...baseData, status: 'completed' });
    expect(run.isActive()).toBe(false);
  });

  it('isActive returns false for other statuses', () => {
    const run = new WorkflowRun({ ...baseData, status: 'cancelled' });
    expect(run.isActive()).toBe(false);
  });
});
