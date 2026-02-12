/**
 * Unit tests for runLocalAction.
 * Mocks getActionInputsWithDefaults, ProjectRepository, mainRun, chalk, boxen.
 */

jest.mock('chalk', () => ({
  cyan: (s: string) => s,
  gray: (s: string) => s,
  red: (s: string) => s,
  default: { cyan: (s: string) => s, gray: (s: string) => s, red: (s: string) => s },
}));
jest.mock('boxen', () => jest.fn((text: string) => text));

jest.mock('../../utils/logger', () => ({
  logInfo: jest.fn(),
}));

const mockGetActionInputsWithDefaults = jest.fn();
jest.mock('../../utils/yml_utils', () => ({
  getActionInputsWithDefaults: () => mockGetActionInputsWithDefaults(),
}));

const mockMainRun = jest.fn();
jest.mock('../common_action', () => ({
  mainRun: (...args: unknown[]) => mockMainRun(...args),
}));

const mockGetProjectDetail = jest.fn();
jest.mock('../../data/repository/project_repository', () => ({
  ProjectRepository: jest.fn().mockImplementation(() => ({
    getProjectDetail: mockGetProjectDetail,
  })),
}));

import { runLocalAction } from '../local_action';
import { INPUT_KEYS } from '../../utils/constants';

/** Minimal defaults so local_action can run (avoids .split on undefined). */
function minimalActionInputs(): Record<string, string> {
  const keys = Object.values(INPUT_KEYS) as string[];
  return Object.fromEntries(keys.map((k) => [k, '']));
}

describe('runLocalAction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetActionInputsWithDefaults.mockReturnValue(minimalActionInputs());
    mockGetProjectDetail.mockResolvedValue({ id: 'p1', title: 'Board', url: 'https://example.com' });
    mockMainRun.mockResolvedValue([]);
  });

  it('builds Execution from additionalParams and actionInputs and calls mainRun', async () => {
    const params: Record<string, unknown> = {
      [INPUT_KEYS.TOKEN]: 'local-token',
      repo: { owner: 'o', repo: 'r' },
      eventName: 'push',
      commits: { ref: 'refs/heads/main' },
    };

    await runLocalAction(params);

    expect(mockMainRun).toHaveBeenCalledTimes(1);
    const execution = mockMainRun.mock.calls[0][0];
    expect(execution).toBeDefined();
    expect(execution.tokens).toBeDefined();
    expect(execution.ai).toBeDefined();
    expect(execution.welcome).toBeDefined();
  });

  it('uses additionalParams over actionInputs defaults', async () => {
    mockGetActionInputsWithDefaults.mockReturnValue({
      ...minimalActionInputs(),
      [INPUT_KEYS.DEBUG]: 'false',
      [INPUT_KEYS.TOKEN]: 'default-token',
    });
    const params: Record<string, unknown> = {
      [INPUT_KEYS.TOKEN]: 'override-token',
      [INPUT_KEYS.DEBUG]: 'true',
      repo: { owner: 'x', repo: 'y' },
      eventName: 'push',
      commits: { ref: 'refs/heads/develop' },
    };

    await runLocalAction(params);

    const execution = mockMainRun.mock.calls[0][0];
    expect(execution.tokens.token).toBe('override-token');
    expect(execution.debug).toBe(true);
  });

  it('logs steps and reminders via boxen after mainRun', async () => {
    const boxen = require('boxen');
    mockMainRun.mockResolvedValue([
      { executed: true, steps: ['Step 1'], errors: [], reminders: [] },
      { executed: true, steps: [], errors: [], reminders: ['Reminder 1'] },
    ]);
    const params: Record<string, unknown> = {
      [INPUT_KEYS.TOKEN]: 't',
      repo: { owner: 'o', repo: 'r' },
      eventName: 'push',
      commits: { ref: 'refs/heads/main' },
    };

    await runLocalAction(params);

    expect(boxen).toHaveBeenCalled();
    expect(boxen.mock.calls[0][0]).toContain('Step 1');
    expect(boxen.mock.calls[0][0]).toContain('Reminder 1');
  });
});
