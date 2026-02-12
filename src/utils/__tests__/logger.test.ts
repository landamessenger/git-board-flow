import {
  setGlobalLoggerDebug,
  setStructuredLogging,
  logInfo,
  logWarn,
  logWarning,
  logError,
  logDebugInfo,
  logDebugWarning,
  logDebugError,
} from '../logger';

describe('logger', () => {
  const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
  const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

  beforeEach(() => {
    jest.clearAllMocks();
    setGlobalLoggerDebug(false);
    setStructuredLogging(false);
  });

  afterAll(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('setGlobalLoggerDebug / setStructuredLogging', () => {
    it('logInfo logs plain message when structured logging is off', () => {
      logInfo('hello');
      expect(consoleLogSpy).toHaveBeenCalledWith('hello');
    });

    it('logInfo logs JSON when structured logging is on', () => {
      setStructuredLogging(true);
      logInfo('hello');
      const call = consoleLogSpy.mock.calls[0][0] as string;
      expect(call).toMatch(/"level":"info"/);
      expect(call).toMatch(/"message":"hello"/);
    });

    it('logInfo adds newline when previousWasSingleLine is true and not remote', () => {
      setGlobalLoggerDebug(false);
      logInfo('second', true);
      expect(consoleLogSpy).toHaveBeenCalledWith();
      expect(consoleLogSpy).toHaveBeenCalledWith('second');
    });
  });

  describe('logWarn / logWarning', () => {
    it('logWarn logs plain message when structured is off', () => {
      logWarn('warn msg');
      expect(consoleWarnSpy).toHaveBeenCalledWith('warn msg');
    });

    it('logWarn logs JSON when structured is on', () => {
      setStructuredLogging(true);
      logWarn('warn msg', { key: 'value' });
      const call = consoleWarnSpy.mock.calls[0][0] as string;
      expect(call).toMatch(/"level":"warn"/);
      expect(call).toMatch(/"message":"warn msg"/);
    });

    it('logWarning calls logWarn', () => {
      logWarning('warning');
      expect(consoleWarnSpy).toHaveBeenCalledWith('warning');
    });
  });

  describe('logError', () => {
    it('logs string message when structured is off', () => {
      logError('error string');
      expect(consoleErrorSpy).toHaveBeenCalledWith('error string');
    });

    it('logs Error message when given Error', () => {
      logError(new Error('my error'));
      expect(consoleErrorSpy).toHaveBeenCalledWith('my error');
    });

    it('logs JSON with stack when structured is on and message is Error', () => {
      setStructuredLogging(true);
      const err = new Error('e');
      logError(err);
      const call = consoleErrorSpy.mock.calls[0][0] as string;
      expect(call).toMatch(/"level":"error"/);
      expect(call).toMatch(/"message":"e"/);
      expect(call).toMatch(/stack/);
    });
  });

  describe('logDebugInfo', () => {
    it('does not log when debug is off', () => {
      setGlobalLoggerDebug(false);
      logDebugInfo('debug msg');
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('logs when debug is on (plain)', () => {
      setGlobalLoggerDebug(true);
      logDebugInfo('debug msg');
      expect(consoleLogSpy).toHaveBeenCalledWith('debug msg');
    });

    it('logs JSON when debug and structured are on', () => {
      setGlobalLoggerDebug(true);
      setStructuredLogging(true);
      logDebugInfo('debug msg');
      const call = consoleLogSpy.mock.calls[0][0] as string;
      expect(call).toMatch(/"level":"debug"/);
    });
  });

  describe('logDebugWarning', () => {
    it('does not log when debug is off', () => {
      logDebugWarning('dw');
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('logs when debug is on', () => {
      setGlobalLoggerDebug(true);
      logDebugWarning('dw');
      expect(consoleWarnSpy).toHaveBeenCalledWith('dw');
    });
  });

  describe('logDebugError', () => {
    it('does not log when debug is off', () => {
      logDebugError('de');
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('logs when debug is on', () => {
      setGlobalLoggerDebug(true);
      logDebugError('de');
      expect(consoleErrorSpy).toHaveBeenCalledWith('de');
    });
  });
});
