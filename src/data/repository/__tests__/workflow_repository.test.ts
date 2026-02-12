import * as github from '@actions/github';
import { WorkflowRepository } from '../workflow_repository';
import type { Execution } from '../../model/execution';
import { WORKFLOW_STATUS } from '../../../utils/constants';

jest.mock('@actions/github');

describe('WorkflowRepository', () => {
  const mockExecution = {
    owner: 'org',
    repo: 'repo',
    tokens: { token: 'token' },
  } as Execution;

  const mockListWorkflowRuns = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (github.getOctokit as jest.Mock).mockReturnValue({
      rest: {
        actions: {
          listWorkflowRunsForRepo: mockListWorkflowRuns,
        },
      },
    });
  });

  describe('getWorkflows', () => {
    it('returns workflow runs mapped to WorkflowRun instances', async () => {
      const rawRuns = [
        {
          id: 100,
          name: 'CI',
          head_branch: 'main',
          head_sha: 'abc',
          run_number: 5,
          event: 'push',
          status: 'completed',
          conclusion: 'success',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:01:00Z',
          url: 'https://api.github.com/...',
          html_url: 'https://github.com/...',
        },
      ];
      mockListWorkflowRuns.mockResolvedValue({ data: { workflow_runs: rawRuns } });

      const repo = new WorkflowRepository();
      const runs = await repo.getWorkflows(mockExecution);

      expect(github.getOctokit).toHaveBeenCalledWith('token');
      expect(mockListWorkflowRuns).toHaveBeenCalledWith({
        owner: 'org',
        repo: 'repo',
      });
      expect(runs).toHaveLength(1);
      expect(runs[0].id).toBe(100);
      expect(runs[0].name).toBe('CI');
      expect(runs[0].status).toBe('completed');
      expect(runs[0].head_branch).toBe('main');
    });

    it('uses "unknown" for missing name and status', async () => {
      mockListWorkflowRuns.mockResolvedValue({
        data: {
          workflow_runs: [
            {
              id: 1,
              name: null,
              head_branch: null,
              head_sha: 'sha',
              run_number: 1,
              event: 'push',
              status: null,
              conclusion: null,
              created_at: '',
              updated_at: '',
              url: '',
              html_url: '',
            },
          ],
        },
      });

      const repo = new WorkflowRepository();
      const runs = await repo.getWorkflows(mockExecution);

      expect(runs[0].name).toBe('unknown');
      expect(runs[0].status).toBe('unknown');
    });
  });

  describe('getActivePreviousRuns', () => {
    it('filters to same workflow, previous run id, and active status', async () => {
      const runId = 200;
      const workflowName = 'CI Check';
      const originalEnv = process.env.GITHUB_RUN_ID;
      const originalWorkflow = process.env.GITHUB_WORKFLOW;
      process.env.GITHUB_RUN_ID = String(runId);
      process.env.GITHUB_WORKFLOW = workflowName;

      mockListWorkflowRuns.mockResolvedValue({
        data: {
          workflow_runs: [
            { id: 199, name: workflowName, status: WORKFLOW_STATUS.IN_PROGRESS, head_branch: 'main', head_sha: 'a', run_number: 1, event: 'push', conclusion: null, created_at: '', updated_at: '', url: '', html_url: '' },
            { id: 198, name: workflowName, status: WORKFLOW_STATUS.QUEUED, head_branch: 'main', head_sha: 'b', run_number: 2, event: 'push', conclusion: null, created_at: '', updated_at: '', url: '', html_url: '' },
            { id: 200, name: workflowName, status: WORKFLOW_STATUS.IN_PROGRESS, head_branch: 'main', head_sha: 'c', run_number: 3, event: 'push', conclusion: null, created_at: '', updated_at: '', url: '', html_url: '' },
            { id: 197, name: 'Other', status: WORKFLOW_STATUS.IN_PROGRESS, head_branch: 'main', head_sha: 'd', run_number: 4, event: 'push', conclusion: null, created_at: '', updated_at: '', url: '', html_url: '' },
            { id: 196, name: workflowName, status: 'completed', head_branch: 'main', head_sha: 'e', run_number: 5, event: 'push', conclusion: 'success', created_at: '', updated_at: '', url: '', html_url: '' },
          ],
        },
      });

      const repo = new WorkflowRepository();
      const active = await repo.getActivePreviousRuns(mockExecution);

      process.env.GITHUB_RUN_ID = originalEnv;
      process.env.GITHUB_WORKFLOW = originalWorkflow;

      expect(active).toHaveLength(2);
      expect(active.map((r) => r.id)).toEqual([199, 198]);
    });
  });
});
