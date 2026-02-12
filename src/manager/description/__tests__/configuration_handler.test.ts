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
      results: [],
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

    it('preserves stored keys when current has undefined', async () => {
      const storedJson = JSON.stringify({
        parentBranch: 'main',
        releaseBranch: 'release/1',
        branchType: 'hotfix',
      });
      mockGetDescription.mockResolvedValue(descriptionWithConfig(storedJson));
      mockUpdateDescription.mockResolvedValue(undefined);

      const execution = minimalExecution({
        currentConfiguration: {
          branchType: 'feature',
          releaseBranch: undefined,
          workingBranch: 'feature/123',
          parentBranch: undefined,
          hotfixOriginBranch: undefined,
          hotfixBranch: undefined,
          results: [],
          branchConfiguration: undefined,
        },
      });

      await handler.update(execution);

      expect(mockUpdateDescription).toHaveBeenCalled();
      const fullDesc = mockUpdateDescription.mock.calls[0][3];
      expect(fullDesc).toContain('"parentBranch": "main"');
      expect(fullDesc).toContain('"releaseBranch": "release/1"');
    });

    it('returns undefined on error', async () => {
      const execution = minimalExecution();
      (execution as { currentConfiguration?: unknown }).currentConfiguration = undefined;

      const result = await handler.update(execution);

      expect(result).toBeUndefined();
    });
  });
});
