/**
 * Unit tests for CLI commands.
 * Mocks execSync (getGitInfo), runLocalAction, IssueRepository, AiRepository.
 */

import { execSync } from 'child_process';
import { program } from '../cli';
import { runLocalAction } from '../actions/local_action';
import { ACTIONS, INPUT_KEYS } from '../utils/constants';

jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

jest.mock('../actions/local_action', () => ({
  runLocalAction: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../utils/logger', () => ({
  logError: jest.fn(),
  logInfo: jest.fn(),
}));

const mockIsIssue = jest.fn();
jest.mock('../data/repository/issue_repository', () => ({
  IssueRepository: jest.fn().mockImplementation(() => ({
    isIssue: mockIsIssue,
  })),
}));

jest.mock('../data/repository/ai_repository', () => ({
  AiRepository: jest.fn().mockImplementation(() => ({
    copilotMessage: jest.fn().mockResolvedValue({ text: 'OK', sessionId: 's1' }),
  })),
}));

describe('CLI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (execSync as jest.Mock).mockReturnValue(Buffer.from('https://github.com/test-owner/test-repo.git'));
    (runLocalAction as jest.Mock).mockResolvedValue(undefined);
    mockIsIssue.mockResolvedValue(true);
  });

  describe('think', () => {
    it('calls runLocalAction with think action and question from -q', async () => {
      await program.parseAsync(['node', 'cli', 'think', '-q', 'how does X work?']);

      expect(runLocalAction).toHaveBeenCalledTimes(1);
      const params = (runLocalAction as jest.Mock).mock.calls[0][0];
      expect(params[INPUT_KEYS.SINGLE_ACTION]).toBe(ACTIONS.THINK);
      expect(params[INPUT_KEYS.WELCOME_TITLE]).toContain('AI Reasoning');
      expect(params.repo).toEqual({ owner: 'test-owner', repo: 'test-repo' });
      expect(params.comment?.body || params.eventName).toBeDefined();
    });

    it('exits with error when getGitInfo fails', async () => {
      (execSync as jest.Mock).mockImplementation(() => {
        throw new Error('git not found');
      });
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {}) as () => never);
      const { logError } = require('../utils/logger');

      await program.parseAsync(['node', 'cli', 'think', '-q', 'hello']);

      expect(logError).toHaveBeenCalled();
      expect(exitSpy).toHaveBeenCalledWith(1);
      exitSpy.mockRestore();
    });

  });

  describe('do', () => {
    it('calls AiRepository and logs response', async () => {
      const { AiRepository } = require('../data/repository/ai_repository');
      const logSpy = jest.spyOn(console, 'log').mockImplementation();

      await program.parseAsync(['node', 'cli', 'do', '-p', 'refactor this']);

      expect(AiRepository).toHaveBeenCalled();
      const instance = AiRepository.mock.results[AiRepository.mock.results.length - 1].value;
      expect(instance.copilotMessage).toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('RESPONSE'));
      logSpy.mockRestore();
    });

  });
});
