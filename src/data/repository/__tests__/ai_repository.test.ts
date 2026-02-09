/**
 * Integration-style tests for AiRepository with mocked fetch.
 * Covers edge cases for the OpenCode-based architecture: missing config,
 * session/message failures, empty/invalid responses, JSON parsing, reasoning, getSessionDiff,
 * and retry behavior (OPENCODE_MAX_RETRIES).
 */

import { OPENCODE_MAX_RETRIES, OPENCODE_RETRY_DELAY_MS } from '../../../utils/constants';
import { AiRepository, getSessionDiff } from '../ai_repository';
import { Ai } from '../../model/ai';

jest.mock('../../../utils/logger', () => ({
  logDebugInfo: jest.fn(),
  logError: jest.fn(),
  logInfo: jest.fn(),
}));

const mockFetch = jest.fn();

function createAi(serverUrl = 'http://localhost:4096', model = 'opencode/kimi-k2.5') {
  return new Ai(serverUrl, model, false, false, [], false);
}

describe('AiRepository', () => {
  let repo: AiRepository;

  beforeEach(() => {
    jest.useFakeTimers();
    repo = new AiRepository();
    mockFetch.mockReset();
    (global as unknown as { fetch: typeof fetch }).fetch = mockFetch;
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('ask', () => {
    it('returns undefined when server URL is missing', async () => {
      const ai = createAi('', 'opencode/model');
      const result = await repo.ask(ai, 'Hello');
      expect(result).toBeUndefined();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('returns undefined when model is empty', async () => {
      const ai = createAi('http://localhost:4096', '');
      const result = await repo.ask(ai, 'Hello');
      expect(result).toBeUndefined();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('returns undefined when session create fails after all retries', async () => {
      const ai = createAi();
      mockFetch.mockResolvedValue({ ok: false, status: 500, text: async () => 'Server error' });
      const promise = repo.ask(ai, 'Hello');
      await jest.advanceTimersByTimeAsync((OPENCODE_MAX_RETRIES - 1) * OPENCODE_RETRY_DELAY_MS);
      const result = await promise;
      expect(result).toBeUndefined();
      expect(mockFetch).toHaveBeenCalledTimes(OPENCODE_MAX_RETRIES);
    });

    it('returns undefined when message request fails after all retries', async () => {
      const ai = createAi();
      const sessionOk = { ok: true, text: async () => JSON.stringify({ id: 'sess-1' }) };
      const messageFail = { ok: false, status: 502, text: async () => 'Bad gateway' };
      for (let i = 0; i < OPENCODE_MAX_RETRIES; i++) {
        mockFetch.mockResolvedValueOnce(sessionOk).mockResolvedValueOnce(messageFail);
      }
      const promise = repo.ask(ai, 'Hello');
      await jest.advanceTimersByTimeAsync((OPENCODE_MAX_RETRIES - 1) * OPENCODE_RETRY_DELAY_MS);
      const result = await promise;
      expect(result).toBeUndefined();
      expect(mockFetch).toHaveBeenCalledTimes(OPENCODE_MAX_RETRIES * 2);
    });

    it('returns undefined when response body is empty after all retries', async () => {
      const ai = createAi();
      const sessionOk = { ok: true, text: async () => JSON.stringify({ id: 'sess-1' }) };
      const emptyBody = { ok: true, status: 200, text: async () => '' };
      for (let i = 0; i < OPENCODE_MAX_RETRIES; i++) {
        mockFetch.mockResolvedValueOnce(sessionOk).mockResolvedValueOnce(emptyBody);
      }
      const promise = repo.ask(ai, 'Hello');
      await jest.advanceTimersByTimeAsync((OPENCODE_MAX_RETRIES - 1) * OPENCODE_RETRY_DELAY_MS);
      const result = await promise;
      expect(result).toBeUndefined();
      expect(mockFetch).toHaveBeenCalledTimes(OPENCODE_MAX_RETRIES * 2);
    });

    it('returns undefined when message response is invalid JSON after all retries', async () => {
      const ai = createAi();
      const sessionOk = { ok: true, text: async () => JSON.stringify({ id: 'sess-1' }) };
      const invalidJson = { ok: true, status: 200, text: async () => 'not json' };
      for (let i = 0; i < OPENCODE_MAX_RETRIES; i++) {
        mockFetch.mockResolvedValueOnce(sessionOk).mockResolvedValueOnce(invalidJson);
      }
      const promise = repo.ask(ai, 'Hello');
      await jest.advanceTimersByTimeAsync((OPENCODE_MAX_RETRIES - 1) * OPENCODE_RETRY_DELAY_MS);
      const result = await promise;
      expect(result).toBeUndefined();
      expect(mockFetch).toHaveBeenCalledTimes(OPENCODE_MAX_RETRIES * 2);
    });

    it('returns extracted text from parts on success', async () => {
      const ai = createAi();
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          text: async () => JSON.stringify({ id: 'sess-1' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              parts: [
                { type: 'text', text: 'Hello back' },
                { type: 'other', data: 'ignored' },
              ],
            }),
        });
      const result = await repo.ask(ai, 'Hello');
      expect(result).toBe('Hello back');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('handles session response with data.id', async () => {
      const ai = createAi();
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          text: async () => JSON.stringify({ data: { id: 'sess-alt' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ parts: [{ type: 'text', text: 'OK' }] }),
        });
      const result = await repo.ask(ai, 'Hi');
      expect(result).toBe('OK');
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        'http://localhost:4096/session/sess-alt/message',
        expect.any(Object)
      );
    });

    it('succeeds on retry after initial session create failure', async () => {
      const ai = createAi();
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 503, text: async () => 'Unavailable' })
        .mockResolvedValueOnce({
          ok: true,
          text: async () => JSON.stringify({ id: 'sess-1' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({ parts: [{ type: 'text', text: 'Recovered' }] }),
        });
      const promise = repo.ask(ai, 'Hello');
      await jest.advanceTimersByTimeAsync(OPENCODE_RETRY_DELAY_MS);
      const result = await promise;
      expect(result).toBe('Recovered');
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('askAgent', () => {
    it('returns undefined when server URL is missing', async () => {
      const ai = createAi('', 'opencode/model');
      const result = await repo.askAgent(ai, 'plan', 'Assess progress', {});
      expect(result).toBeUndefined();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('returns undefined when session create fails after all retries', async () => {
      const ai = createAi();
      mockFetch.mockResolvedValue({ ok: false, status: 503, text: async () => 'Unavailable' });
      const promise = repo.askAgent(ai, 'plan', 'Prompt', {});
      await jest.advanceTimersByTimeAsync((OPENCODE_MAX_RETRIES - 1) * OPENCODE_RETRY_DELAY_MS);
      const result = await promise;
      expect(result).toBeUndefined();
      expect(mockFetch).toHaveBeenCalledTimes(OPENCODE_MAX_RETRIES);
    });

    it('returns undefined when agent message request fails after all retries', async () => {
      const ai = createAi();
      const sessionOk = { ok: true, text: async () => JSON.stringify({ id: 's1' }) };
      const messageFail = { ok: false, status: 500, text: async () => 'Agent error' };
      for (let i = 0; i < OPENCODE_MAX_RETRIES; i++) {
        mockFetch.mockResolvedValueOnce(sessionOk).mockResolvedValueOnce(messageFail);
      }
      const promise = repo.askAgent(ai, 'plan', 'Prompt', {});
      await jest.advanceTimersByTimeAsync((OPENCODE_MAX_RETRIES - 1) * OPENCODE_RETRY_DELAY_MS);
      const result = await promise;
      expect(result).toBeUndefined();
      expect(mockFetch).toHaveBeenCalledTimes(OPENCODE_MAX_RETRIES * 2);
    });

    it('returns plain text when expectJson is false', async () => {
      const ai = createAi();
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          text: async () => JSON.stringify({ id: 's1' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              parts: [{ type: 'text', text: 'Just a string response' }],
            }),
        });
      const result = await repo.askAgent(ai, 'plan', 'Prompt', {});
      expect(result).toBe('Just a string response');
    });

    it('returns parsed JSON when expectJson is true', async () => {
      const ai = createAi();
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          text: async () => JSON.stringify({ id: 's1' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              parts: [{ type: 'text', text: '{"progress": 75, "summary": "Almost done"}' }],
            }),
        });
      const result = await repo.askAgent(ai, 'plan', 'Assess', {
        expectJson: true,
        schema: { type: 'object', properties: { progress: {}, summary: {} } },
      });
      expect(result).toEqual({ progress: 75, summary: 'Almost done' });
    });

    it('strips markdown code block from JSON when expectJson is true', async () => {
      const ai = createAi();
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          text: async () => JSON.stringify({ id: 's1' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              parts: [
                {
                  type: 'text',
                  text: '```json\n{"progress": 100, "summary": "Done"}\n```',
                },
              ],
            }),
        });
      const result = await repo.askAgent(ai, 'plan', 'Assess', {
        expectJson: true,
        schema: {},
      });
      expect(result).toEqual({ progress: 100, summary: 'Done' });
    });

    it('includes reasoning in result when includeReasoning is true', async () => {
      const ai = createAi();
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          text: async () => JSON.stringify({ id: 's1' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              parts: [
                { type: 'reasoning', text: 'First I considered the diff.' },
                { type: 'text', text: '{"progress": 50, "summary": "Half"}' },
              ],
            }),
        });
      const result = await repo.askAgent(ai, 'plan', 'Assess', {
        expectJson: true,
        schema: {},
        includeReasoning: true,
      });
      expect(result).toMatchObject({
        progress: 50,
        summary: 'Half',
        reasoning: 'First I considered the diff.',
      });
    });

    it('returns undefined when expectJson is true but response is invalid JSON', async () => {
      const ai = createAi();
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          text: async () => JSON.stringify({ id: 's1' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              parts: [{ type: 'text', text: 'not valid json at all' }],
            }),
        });
      const result = await repo.askAgent(ai, 'plan', 'Assess', { expectJson: true, schema: {} });
      expect(result).toBeUndefined();
    });

    it('removes trailing slash from server URL', async () => {
      const ai = createAi('http://localhost:4096/', 'opencode/model');
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          text: async () => JSON.stringify({ id: 's1' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ parts: [{ type: 'text', text: 'OK' }] }),
        });
      await repo.askAgent(ai, 'plan', 'P', {});
      expect(mockFetch).toHaveBeenNthCalledWith(1, 'http://localhost:4096/session', expect.any(Object));
    });
  });

  describe('copilotMessage', () => {
    it('returns undefined when model is missing', async () => {
      const ai = createAi('http://localhost:4096', '');
      const result = await repo.copilotMessage(ai, 'Do something');
      expect(result).toBeUndefined();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('returns undefined when build agent request fails after all retries', async () => {
      const ai = createAi();
      const sessionOk = { ok: true, text: async () => JSON.stringify({ id: 's1' }) };
      const messageFail = { ok: false, status: 500, text: async () => 'Error' };
      for (let i = 0; i < OPENCODE_MAX_RETRIES; i++) {
        mockFetch.mockResolvedValueOnce(sessionOk).mockResolvedValueOnce(messageFail);
      }
      const promise = repo.copilotMessage(ai, 'Edit file');
      await jest.advanceTimersByTimeAsync((OPENCODE_MAX_RETRIES - 1) * OPENCODE_RETRY_DELAY_MS);
      const result = await promise;
      expect(result).toBeUndefined();
      expect(mockFetch).toHaveBeenCalledTimes(OPENCODE_MAX_RETRIES * 2);
    });

    it('returns text and sessionId on success', async () => {
      const ai = createAi();
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          text: async () => JSON.stringify({ id: 'copilot-session-1' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              parts: [{ type: 'text', text: 'I updated the file.' }],
            }),
        });
      const result = await repo.copilotMessage(ai, 'Edit file');
      expect(result).toEqual({ text: 'I updated the file.', sessionId: 'copilot-session-1' });
    });
  });
});

describe('getSessionDiff', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockFetch.mockReset();
    (global as unknown as { fetch: typeof fetch }).fetch = mockFetch;
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('returns empty array when response is not ok', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    const result = await getSessionDiff('http://localhost:4096', 'sess-1');
    expect(result).toEqual([]);
  });

  it('returns empty array when body is empty', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, text: async () => '' });
    const result = await getSessionDiff('http://localhost:4096', 'sess-1');
    expect(result).toEqual([]);
  });

  it('returns empty array when body is invalid JSON', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, text: async () => 'invalid' });
    const result = await getSessionDiff('http://localhost:4096', 'sess-1');
    expect(result).toEqual([]);
  });

  it('returns array when response is array of diffs', async () => {
    const diffs = [{ path: 'src/foo.ts', file: 'content' }];
    mockFetch.mockResolvedValueOnce({ ok: true, text: async () => JSON.stringify(diffs) });
    const result = await getSessionDiff('http://localhost:4096', 'sess-1');
    expect(result).toEqual(diffs);
  });

  it('returns data array when response is { data: [...] }', async () => {
    const diffs = [{ path: 'a.ts' }];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ data: diffs }),
    });
    const result = await getSessionDiff('http://localhost:4096', 'sess-1');
    expect(result).toEqual(diffs);
  });

  it('strips trailing slash from base URL', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, text: async () => '[]' });
    await getSessionDiff('http://localhost:4096/', 's1');
    expect(mockFetch).toHaveBeenCalledWith('http://localhost:4096/session/s1/diff', expect.any(Object));
  });
});
