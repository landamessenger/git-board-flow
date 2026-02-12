/**
 * Unit tests for runGitHubAction.
 * Mocks @actions/core, ProjectRepository, mainRun, and finish flow.
 */

import * as core from '@actions/core';
import { runGitHubAction } from '../github_action';
import { INPUT_KEYS } from '../../utils/constants';

jest.mock('@actions/core', () => ({
  getInput: jest.fn(),
  setFailed: jest.fn(),
}));

jest.mock('../../utils/logger', () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
}));

jest.mock('../../utils/opencode_server', () => ({
  startOpencodeServer: jest.fn(),
}));

const mockMainRun = jest.fn();
jest.mock('../common_action', () => ({
  mainRun: (...args: unknown[]) => mockMainRun(...args),
}));

const mockPublishInvoke = jest.fn();
const mockStoreInvoke = jest.fn();
jest.mock('../../usecase/steps/common/publish_resume_use_case', () => ({
  PublishResultUseCase: jest.fn().mockImplementation(() => ({ invoke: mockPublishInvoke })),
}));
jest.mock('../../usecase/steps/common/store_configuration_use_case', () => ({
  StoreConfigurationUseCase: jest.fn().mockImplementation(() => ({ invoke: mockStoreInvoke })),
}));

const mockGetProjectDetail = jest.fn();
jest.mock('../../data/repository/project_repository', () => ({
  ProjectRepository: jest.fn().mockImplementation(() => ({
    getProjectDetail: mockGetProjectDetail,
  })),
}));

describe('runGitHubAction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (core.getInput as jest.Mock).mockImplementation((key: string, opts?: { required?: boolean }) => {
      if (opts?.required && key === INPUT_KEYS.TOKEN) return 'fake-token';
      return '';
    });
    mockGetProjectDetail.mockResolvedValue({ id: 'p1', title: 'Board', url: 'https://example.com' });
    mockMainRun.mockResolvedValue([]);
    mockPublishInvoke.mockResolvedValue([]);
    mockStoreInvoke.mockResolvedValue([]);
  });

  it('builds Execution and calls mainRun', async () => {
    await runGitHubAction();

    expect(core.getInput).toHaveBeenCalledWith(INPUT_KEYS.TOKEN, { required: true });
    expect(mockMainRun).toHaveBeenCalledTimes(1);
    const execution = mockMainRun.mock.calls[0][0];
    expect(execution).toBeDefined();
    expect(execution.tokens).toBeDefined();
    expect(execution.ai).toBeDefined();
    expect(execution.singleAction).toBeDefined();
  });

  it('does not start OpenCode server when opencode-start-server is not true', async () => {
    const { startOpencodeServer } = require('../../utils/opencode_server');
    await runGitHubAction();
    expect(startOpencodeServer).not.toHaveBeenCalled();
  });

  it('calls finishWithResults (PublishResult and StoreConfiguration) after mainRun', async () => {
    await runGitHubAction();

    expect(mockPublishInvoke).toHaveBeenCalledTimes(1);
    expect(mockStoreInvoke).toHaveBeenCalledTimes(1);
  });

  it('uses INPUT_VARS_JSON when set for getInput', async () => {
    const inputVarsJson = JSON.stringify({
      INPUT_TOKEN: 'from-env-token',
      INPUT_DEBUG: 'true',
    });
    const orig = process.env.INPUT_VARS_JSON;
    process.env.INPUT_VARS_JSON = inputVarsJson;
    (core.getInput as jest.Mock).mockImplementation(() => '');

    await runGitHubAction();

    const execution = mockMainRun.mock.calls[0][0];
    expect(execution).toBeDefined();
    process.env.INPUT_VARS_JSON = orig;
  });
});
