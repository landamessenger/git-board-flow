import { waitForPreviousRuns } from '../queue_utils';
import { WorkflowRepository } from '../../data/repository/workflow_repository';
import type { Execution } from '../../data/model/execution';

jest.mock('../../data/repository/workflow_repository');
jest.mock('../logger', () => ({
  logDebugInfo: jest.fn(),
}));

describe('queue_utils', () => {
  const mockExecution = {} as Execution;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('waitForPreviousRuns', () => {
    it('returns immediately when no previous runs are active', async () => {
      const getActivePreviousRuns = jest.fn().mockResolvedValue([]);
      (WorkflowRepository as jest.MockedClass<typeof WorkflowRepository>).mockImplementation(
        () => ({ getActivePreviousRuns } as unknown as WorkflowRepository)
      );

      const promise = waitForPreviousRuns(mockExecution);
      await Promise.resolve();
      await promise;

      expect(getActivePreviousRuns).toHaveBeenCalledWith(mockExecution);
      expect(getActivePreviousRuns).toHaveBeenCalledTimes(1);
    });

    it('waits and retries until no active runs then continues', async () => {
      const getActivePreviousRuns = jest
        .fn()
        .mockResolvedValueOnce([{ id: 1, name: 'ci' } as never])
        .mockResolvedValueOnce([{ id: 1, name: 'ci' } as never])
        .mockResolvedValue([]);

      (WorkflowRepository as jest.MockedClass<typeof WorkflowRepository>).mockImplementation(
        () => ({ getActivePreviousRuns } as unknown as WorkflowRepository)
      );

      const promise = waitForPreviousRuns(mockExecution);

      await jest.advanceTimersByTimeAsync(0);
      expect(getActivePreviousRuns).toHaveBeenCalledTimes(1);

      await jest.advanceTimersByTimeAsync(2000);
      await jest.advanceTimersByTimeAsync(0);
      expect(getActivePreviousRuns).toHaveBeenCalledTimes(2);

      await jest.advanceTimersByTimeAsync(2000);
      await jest.advanceTimersByTimeAsync(0);
      expect(getActivePreviousRuns).toHaveBeenCalledTimes(3);

      await promise;
      expect(getActivePreviousRuns).toHaveBeenCalledTimes(3);
    });

    it('throws after 2000 attempts (timeout)', async () => {
      const getActivePreviousRuns = jest.fn().mockResolvedValue([{ id: 1 } as never]);

      (WorkflowRepository as jest.MockedClass<typeof WorkflowRepository>).mockImplementation(
        () => ({ getActivePreviousRuns } as unknown as WorkflowRepository)
      );

      const promise = waitForPreviousRuns(mockExecution);
      const expectPromise = expect(promise).rejects.toThrow(
        'Timeout waiting for previous runs to finish.'
      );

      await jest.advanceTimersByTimeAsync(2000 * 2000 + 1000);
      await expectPromise;
      expect(getActivePreviousRuns).toHaveBeenCalledTimes(2000);
    }, 10000);
  });
});
