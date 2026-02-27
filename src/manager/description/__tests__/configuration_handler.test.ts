import { ConfigurationHandler } from '../configuration_handler';
import type { Execution } from '../../../data/model/execution';

jest.mock('../../../utils/logger', () => ({
  logError: jest.fn(),
}));

const mockGetDescription = jest.fn();
const mockUpdateDescription = jest.fn();

jest.mock('../../../data/repository/issue_repository', () => ({
  IssueRepository: jest.fn().mockImplementation(() => ({
    getDescription: mockGetDescription,
    updateDescription: mockUpdateDescription,
  })),
}));

const CONFIG_START = '<!-- copilot-configuration-start';
const CONFIG_END = 'copilot-configuration-end -->';

function descriptionWithConfig(configJson: string): string {
  return `body\n${CONFIG_START}\n${configJson}\n${CONFIG_END}\ntail`;
}

function minimalExecution(overrides: Record<string, unknown> = {}): Execution {
  return {
    owner: 'o',
    repo: 'r',
    tokens: { token: 't' },
    isIssue: true,
    isPullRequest: false,
    isPush: false,
    isSingleAction: false,
    issue: { number: 1 },
    pullRequest: { number: 0 },
    issueNumber: 1,
    currentConfiguration: {
      branchType: 'feature',
      releaseBranch: undefined,
      workingBranch: 'feature/123',
      parentBranch: 'develop',
      hotfixOriginBranch: undefined,
      hotfixBranch: undefined,
      branchConfiguration: undefined,
    },
    ...overrides,
  } as unknown as Execution;
}

describe('ConfigurationHandler', () => {
  let handler: ConfigurationHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    handler = new ConfigurationHandler();
  });

  describe('id and visibleContent', () => {
    it('returns configuration id and visibleContent false', () => {
      expect(handler.id).toBe('configuration');
      expect(handler.visibleContent).toBe(false);
    });
  });

  describe('get', () => {
    it('returns undefined when internalGetter returns undefined', async () => {
      mockGetDescription.mockResolvedValue('no config block here');
      const execution = minimalExecution();

      const result = await handler.get(execution);

      expect(result).toBeUndefined();
    });

    it('returns Config when description contains valid config JSON', async () => {
      const configJson = JSON.stringify({ branchType: 'feature', parentBranch: 'develop' });
      mockGetDescription.mockResolvedValue(descriptionWithConfig(configJson));
      const execution = minimalExecution();

      const result = await handler.get(execution);

      expect(result).toBeDefined();
      expect(result?.branchType).toBe('feature');
      expect(result?.parentBranch).toBe('develop');
    });

    it('throws when config JSON is invalid', async () => {
      mockGetDescription.mockResolvedValue(descriptionWithConfig('not json'));
      const execution = minimalExecution();

      await expect(handler.get(execution)).rejects.toThrow();
    });
  });

  describe('update', () => {
    it('calls internalUpdate with stringified payload when no stored config', async () => {
      mockGetDescription.mockResolvedValue('no block');
      mockUpdateDescription.mockResolvedValue(undefined);

      const execution = minimalExecution();
      await handler.update(execution);

      expect(mockUpdateDescription).toHaveBeenCalled();
      const updatedDesc = mockUpdateDescription.mock.calls[0][3];
      expect(updatedDesc).toMatch(/"branchType":\s*"feature"/);
      expect(updatedDesc).toMatch(/"workingBranch":\s*"feature\/123"/);
    });

    it('preserves all stored keys (including unknown ones) when current has undefined', async () => {
      const storedJson = JSON.stringify({
        parentBranch: 'main',
        unknownKey: 'preserve-me',
        branchConfiguration: { name: 'leaf' },
      });
      mockGetDescription.mockResolvedValue(descriptionWithConfig(storedJson));
      mockUpdateDescription.mockResolvedValue(undefined);

      const execution = minimalExecution({
        currentConfiguration: {
          parentBranch: undefined,
          branchConfiguration: undefined,
        },
      });

      await handler.update(execution);

      expect(mockUpdateDescription).toHaveBeenCalled();
      const fullDesc = mockUpdateDescription.mock.calls[0][3];
      const parsed = JSON.parse(handler.getContent(fullDesc)!.trim());
      expect(parsed.parentBranch).toBe('main');
      expect(parsed.unknownKey).toBe('preserve-me');
      expect(parsed.branchConfiguration).toEqual({ name: 'leaf' });
    });

    it('always excludes results from the saved payload even if present in stored', async () => {
      const storedJson = JSON.stringify({
        results: [{ some: 'result' }],
        parentBranch: 'main',
      });
      mockGetDescription.mockResolvedValue(descriptionWithConfig(storedJson));
      mockUpdateDescription.mockResolvedValue(undefined);

      const execution = minimalExecution({
        currentConfiguration: {
          parentBranch: 'develop',
        },
      });

      await handler.update(execution);

      const fullDesc = mockUpdateDescription.mock.calls[0][3];
      const parsed = JSON.parse(handler.getContent(fullDesc)!.trim());
      expect(parsed.results).toBeUndefined();
      expect(parsed.parentBranch).toBe('develop');
    });

    it('fails safely when block is mangled (missing end tag)', async () => {
      const mangledDesc = `body\n${CONFIG_START}\n{"x":1}\nno end tag here`;
      mockGetDescription.mockResolvedValue(mangledDesc);

      const execution = minimalExecution();
      const result = await handler.update(execution);

      // Should log error and return undefined instead of corrupting or crashing
      expect(result).toBeUndefined();
      const { logError } = require('../../../utils/logger');
      expect(logError).toHaveBeenCalledWith(expect.stringContaining('problem with open-close tags'));
    });

    it('handles malformed JSON in stored config gracefully', async () => {
      mockGetDescription.mockResolvedValue(descriptionWithConfig('invalid { json'));
      mockUpdateDescription.mockResolvedValue(undefined);

      const execution = minimalExecution({
        currentConfiguration: {
          branchType: 'feature',
          workingBranch: 'feat/new',
        },
      });

      await handler.update(execution);

      expect(mockUpdateDescription).toHaveBeenCalled();
      const fullDesc = mockUpdateDescription.mock.calls[0][3];
      expect(fullDesc).toContain('"branchType": "feature"');
      expect(fullDesc).toContain('"workingBranch": "feat/new"');
    });

    it('handles empty stored config block gracefully', async () => {
      mockGetDescription.mockResolvedValue(descriptionWithConfig('  '));
      mockUpdateDescription.mockResolvedValue(undefined);

      const execution = minimalExecution({
        currentConfiguration: {
          branchType: 'feature',
        },
      });

      await handler.update(execution);

      expect(mockUpdateDescription).toHaveBeenCalled();
      expect(mockUpdateDescription.mock.calls[0][3]).toContain('"branchType": "feature"');
    });

    it('returns undefined on error', async () => {
      const execution = minimalExecution();
      (execution as { currentConfiguration?: unknown }).currentConfiguration = undefined;

      const result = await handler.update(execution);

      expect(result).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('get returns undefined when internalGetter returns empty string', async () => {
      mockGetDescription.mockResolvedValue('');
      const execution = minimalExecution();
      const result = await handler.get(execution);
      expect(result).toBeUndefined();
    });

    it('get throws informative error on invalid JSON', async () => {
      mockGetDescription.mockResolvedValue(descriptionWithConfig('{ "broken": '));
      const execution = minimalExecution();
      await expect(handler.get(execution)).rejects.toThrow(/Unexpected end of JSON input|SyntaxError/);
    });
  });
});
