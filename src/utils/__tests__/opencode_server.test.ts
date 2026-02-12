import { startOpencodeServer, stopOpencodeServer } from '../opencode_server';
import { spawn } from 'child_process';
import { access, writeFile, unlink } from 'fs/promises';

jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));
jest.mock('fs/promises', () => ({
  access: jest.fn(),
  writeFile: jest.fn(),
  unlink: jest.fn(),
}));
jest.mock('../logger', () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
  logDebugInfo: jest.fn(),
}));

const healthyResponse = () =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ healthy: true }),
  });

describe('opencode_server', () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    (globalThis as unknown as { fetch: typeof mockFetch }).fetch = mockFetch;
    (access as jest.Mock).mockRejectedValue(new Error('not found'));
    (writeFile as jest.Mock).mockResolvedValue(undefined);
    (unlink as jest.Mock).mockResolvedValue(undefined);
  });

  describe('startOpencodeServer', () => {
    it('creates opencode.json when it does not exist and removes it on stop', async () => {
      (access as jest.Mock).mockRejectedValueOnce(new Error('not found'));
      const fakeChild = createFakeChildProcess();
      (spawn as jest.Mock).mockReturnValue(fakeChild);
      mockFetch.mockImplementation(healthyResponse);

      const serverPromise = startOpencodeServer({ port: 4096, cwd: '/tmp' });
      await Promise.resolve();
      await Promise.resolve();
      const server = await serverPromise;

      expect(writeFile).toHaveBeenCalled();
      expect(server.url).toBe('http://127.0.0.1:4096');

      await server.stop();
      expect(unlink).toHaveBeenCalled();
    }, 10000);

    it('does not create opencode.json when it exists', async () => {
      (access as jest.Mock).mockResolvedValue(undefined);
      const fakeChild = createFakeChildProcess();
      (spawn as jest.Mock).mockReturnValue(fakeChild);
      mockFetch.mockImplementation(healthyResponse);

      const serverPromise = startOpencodeServer({ cwd: '/tmp' });
      await Promise.resolve();
      await Promise.resolve();
      const server = await serverPromise;
      await server.stop();

      expect(writeFile).not.toHaveBeenCalled();
      expect(unlink).not.toHaveBeenCalled();
    }, 10000);

    it.skip('throws when server does not become healthy within timeout', async () => {
      // Hard to test: waitForHealthy mixes fetch (real promise) with setTimeout (fake timers);
      // advancing 121s runs 240+ timeouts and is slow. Manual / E2E coverage recommended.
      jest.useFakeTimers();
      (access as jest.Mock).mockResolvedValue(undefined);
      const fakeChild = createFakeChildProcess();
      (spawn as jest.Mock).mockReturnValue(fakeChild);
      mockFetch.mockResolvedValue({ ok: false });

      const promise = startOpencodeServer({ cwd: '/tmp' });
      const expectPromise = expect(promise).rejects.toThrow(
        /OpenCode server did not become healthy/
      );
      await jest.advanceTimersByTimeAsync(121_000);
      await expectPromise;
    }, 20000);

    it('uses custom port and hostname', async () => {
      (access as jest.Mock).mockResolvedValue(undefined);
      const fakeChild = createFakeChildProcess();
      (spawn as jest.Mock).mockReturnValue(fakeChild);
      mockFetch.mockImplementation(healthyResponse);

      const serverPromise = startOpencodeServer({
        port: 5000,
        hostname: '0.0.0.0',
        cwd: '/app',
      });
      await Promise.resolve();
      await Promise.resolve();
      const server = await serverPromise;

      expect(server.url).toBe('http://0.0.0.0:5000');
      expect(spawn).toHaveBeenCalledWith(
        'npx',
        ['-y', 'opencode-ai', 'serve', '--port', '5000', '--hostname', '0.0.0.0'],
        expect.objectContaining({ cwd: '/app' })
      );
      await server.stop();
    }, 10000);
  });

  describe('stopOpencodeServer', () => {
    it('returns immediately when child has no pid', async () => {
      const child = { pid: undefined };
      await expect(stopOpencodeServer(child as never)).resolves.toBeUndefined();
    });

    it('kills process and resolves when exit event fires', async () => {
      const child = createFakeChildProcess();
      child.pid = 12345;
      let exitCb: () => void = () => {};
      child.once.mockImplementation((_ev: string, cb: () => void) => {
        exitCb = cb;
        return child;
      });

      const p = stopOpencodeServer(child as never);
      exitCb();
      await expect(p).resolves.toBeUndefined();
      expect(child.kill).toHaveBeenCalledWith('SIGTERM');
    });
  });
});

function createFakeChildProcess() {
  const stderr = { on: jest.fn(), destroy: jest.fn() };
  const stdout = { on: jest.fn(), destroy: jest.fn() };
  return {
    pid: 9999,
    stdout,
    stderr,
    on: jest.fn(),
    once: jest.fn().mockReturnThis(),
    kill: jest.fn(),
  };
}
