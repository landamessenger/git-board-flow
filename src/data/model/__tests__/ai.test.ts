import { OPENCODE_DEFAULT_MODEL } from '../../../utils/constants';
import { Ai } from '../ai';

describe('Ai', () => {
  const defaultArgs: [
    string,
    string,
    boolean,
    boolean,
    string[],
    boolean,
    string,
    number,
  ] = [
    'https://opencode.example',
    'opencode/kimi-k2.5-free',
    true,
    false,
    ['*.min.js'],
    true,
    'warning',
    10,
  ];

  function createAi(
    overrides: Partial<{
      opencodeServerUrl: string;
      opencodeModel: string;
      aiPullRequestDescription: boolean;
      aiMembersOnly: boolean;
      aiIgnoreFiles: string[];
      aiIncludeReasoning: boolean;
      bugbotMinSeverity: string;
      bugbotCommentLimit: number;
      bugbotFixVerifyCommands: string[];
    }> = {},
  ): Ai {
    return new Ai(
      overrides.opencodeServerUrl ?? defaultArgs[0],
      overrides.opencodeModel ?? defaultArgs[1],
      overrides.aiPullRequestDescription ?? defaultArgs[2],
      overrides.aiMembersOnly ?? defaultArgs[3],
      overrides.aiIgnoreFiles ?? defaultArgs[4],
      overrides.aiIncludeReasoning ?? defaultArgs[5],
      overrides.bugbotMinSeverity ?? defaultArgs[6],
      overrides.bugbotCommentLimit ?? defaultArgs[7],
      overrides.bugbotFixVerifyCommands,
    );
  }

  describe('constructor and getters', () => {
    it('stores and returns all constructor values', () => {
      const ai = new Ai(
        'https://server',
        'anthropic/claude-3',
        true,
        true,
        ['a', 'b'],
        false,
        'error',
        5,
        ['npm run test'],
      );

      expect(ai.getOpencodeServerUrl()).toBe('https://server');
      expect(ai.getOpencodeModel()).toBe('anthropic/claude-3');
      expect(ai.getAiPullRequestDescription()).toBe(true);
      expect(ai.getAiMembersOnly()).toBe(true);
      expect(ai.getAiIgnoreFiles()).toEqual(['a', 'b']);
      expect(ai.getAiIncludeReasoning()).toBe(false);
      expect(ai.getBugbotMinSeverity()).toBe('error');
      expect(ai.getBugbotCommentLimit()).toBe(5);
      expect(ai.getBugbotFixVerifyCommands()).toEqual(['npm run test']);
    });

    it('defaults bugbotFixVerifyCommands to empty array when omitted', () => {
      const ai = new Ai(
        defaultArgs[0],
        defaultArgs[1],
        defaultArgs[2],
        defaultArgs[3],
        defaultArgs[4],
        defaultArgs[5],
        defaultArgs[6],
        defaultArgs[7],
      );

      expect(ai.getBugbotFixVerifyCommands()).toEqual([]);
    });
  });

  describe('getOpencodeModelParts', () => {
    it('returns provider and model when opencodeModel is "provider/model"', () => {
      const ai = createAi({ opencodeModel: 'anthropic/claude-3-opus' });

      expect(ai.getOpencodeModelParts()).toEqual({
        providerID: 'anthropic',
        modelID: 'claude-3-opus',
      });
    });

    it('trims whitespace from provider and model', () => {
      const ai = createAi({ opencodeModel: '  openai / gpt-4  ' });

      expect(ai.getOpencodeModelParts()).toEqual({
        providerID: 'openai',
        modelID: 'gpt-4',
      });
    });

    it('uses OPENCODE_DEFAULT_MODEL when opencodeModel is empty string', () => {
      const ai = createAi({ opencodeModel: '' });

      expect(ai.getOpencodeModelParts()).toEqual({
        providerID: 'opencode',
        modelID: 'kimi-k2.5-free',
      });
    });

    it('uses OPENCODE_DEFAULT_MODEL when opencodeModel is whitespace-only', () => {
      const ai = createAi({ opencodeModel: '   ' });

      expect(ai.getOpencodeModelParts()).toEqual({
        providerID: 'opencode',
        modelID: 'kimi-k2.5-free',
      });
    });

    it('when no slash returns providerID "opencode" and modelID as effective', () => {
      const ai = createAi({ opencodeModel: 'single-model-id' });

      expect(ai.getOpencodeModelParts()).toEqual({
        providerID: 'opencode',
        modelID: 'single-model-id',
      });
    });

    it('when slash at start (slash <= 0) uses opencode and effective as modelID', () => {
      const ai = createAi({ opencodeModel: '/only-model' });

      expect(ai.getOpencodeModelParts()).toEqual({
        providerID: 'opencode',
        modelID: '/only-model',
      });
    });

    it('when model is empty after trim uses default modelID from OPENCODE_DEFAULT_MODEL', () => {
      const ai = createAi({ opencodeModel: 'provider/   ' });

      expect(ai.getOpencodeModelParts()).toEqual({
        providerID: 'provider',
        modelID: 'kimi-k2.5-free',
      });
    });

    it('uses OPENCODE_DEFAULT_MODEL when opencodeModel is not set (falsy)', () => {
      const ai = createAi({ opencodeModel: '' });
      const parts = ai.getOpencodeModelParts();

      expect(parts.providerID).toBe('opencode');
      expect(parts.modelID).toBe(OPENCODE_DEFAULT_MODEL.split('/')[1]);
    });

    it('uses "opencode" when provider part is empty after trim', () => {
      const ai = createAi({ opencodeModel: 'x' });
      const originalTrim = String.prototype.trim;
      let trimCallCount = 0;
      jest.spyOn(String.prototype, 'trim').mockImplementation(function (this: string) {
        trimCallCount++;
        if (trimCallCount === 1) {
          return '  /model';
        }
        if (this === '  ') {
          return '';
        }
        return originalTrim.call(this);
      });

      const parts = ai.getOpencodeModelParts();

      expect(parts).toEqual({ providerID: 'opencode', modelID: 'model' });
      (String.prototype.trim as jest.Mock).mockRestore();
    });
  });
});
