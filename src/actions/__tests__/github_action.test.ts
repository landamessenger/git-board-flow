/**
 * Unit tests for runGitHubAction.
 * Mocks @actions/core, ProjectRepository, mainRun, and finish flow.
 */

import * as core from '@actions/core';
import { runGitHubAction } from '../github_action';
import { ACTIONS, INPUT_KEYS } from '../../utils/constants';

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

  it('starts OpenCode server and stops it in finally when opencode-start-server is true', async () => {
    const mockStop = jest.fn().mockResolvedValue(undefined);
    const { startOpencodeServer } = require('../../utils/opencode_server');
    (startOpencodeServer as jest.Mock).mockResolvedValue({ url: 'http://started:4096', stop: mockStop });
    (core.getInput as jest.Mock).mockImplementation((key: string, opts?: { required?: boolean }) => {
      if (key === INPUT_KEYS.OPENCODE_START_SERVER) return 'true';
      if (opts?.required && key === INPUT_KEYS.TOKEN) return 'fake-token';
      return '';
    });

    await runGitHubAction();

    expect(startOpencodeServer).toHaveBeenCalledWith({ cwd: process.cwd() });
    expect(mockStop).toHaveBeenCalledTimes(1);
    const execution = mockMainRun.mock.calls[0][0];
    expect(execution.ai.getOpencodeServerUrl()).toBe('http://started:4096');
  });

  it('calls setFailed and stops server when mainRun throws', async () => {
    const mockStop = jest.fn().mockResolvedValue(undefined);
    const { startOpencodeServer } = require('../../utils/opencode_server');
    (startOpencodeServer as jest.Mock).mockResolvedValue({ url: 'http://x', stop: mockStop });
    (core.getInput as jest.Mock).mockImplementation((key: string, opts?: { required?: boolean }) => {
      if (key === INPUT_KEYS.OPENCODE_START_SERVER) return 'true';
      if (opts?.required && key === INPUT_KEYS.TOKEN) return 'fake-token';
      return '';
    });
    mockMainRun.mockRejectedValue(new Error('mainRun failed'));

    await expect(runGitHubAction()).rejects.toThrow('mainRun failed');

    expect(core.setFailed).not.toHaveBeenCalled();
    expect(mockStop).toHaveBeenCalledTimes(1);
  });

  it('calls setFailed when finishWithResults runs with single action throwError and results have errors', async () => {
    const { Result } = require('../../data/model/result');
    (core.getInput as jest.Mock).mockImplementation((key: string, opts?: { required?: boolean }) => {
      if (key === INPUT_KEYS.SINGLE_ACTION) return ACTIONS.CREATE_RELEASE;
      if (key === INPUT_KEYS.SINGLE_ACTION_ISSUE) return '42';
      if (opts?.required && key === INPUT_KEYS.TOKEN) return 'fake-token';
      return '';
    });
    mockMainRun.mockResolvedValue([
      new Result({ id: 'a', success: false, executed: true, errors: ['First error'] }),
    ]);

    await runGitHubAction();

    expect(mockPublishInvoke).toHaveBeenCalled();
    expect(core.setFailed).toHaveBeenCalledWith('First error');
  });

  it('calls logError when INPUT_VARS_JSON is invalid JSON', async () => {
    const orig = process.env.INPUT_VARS_JSON;
    process.env.INPUT_VARS_JSON = 'not valid json';
    const { logError } = require('../../utils/logger');

    await runGitHubAction();

    expect(logError).toHaveBeenCalledWith(expect.stringContaining('INPUT_VARS_JSON'));
    process.env.INPUT_VARS_JSON = orig;
  });
});
