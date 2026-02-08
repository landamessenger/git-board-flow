jest.mock('chalk', () => {
  const id = (s: string) => s;
  const withBold = () => Object.assign(id, { bold: id });
  return {
    __esModule: true,
    default: {
      cyan: withBold(),
      white: withBold(),
      gray: id,
      green: withBold(),
      blue: id,
      yellow: id,
    },
  };
});
jest.mock('../logger', () => ({
  logInfo: jest.fn(),
  logSingleLine: jest.fn(),
}));

import { ReasoningVisualizer } from '../reasoning_visualizer';

describe('ReasoningVisualizer', () => {
  let visualizer: ReasoningVisualizer;

  beforeEach(() => {
    visualizer = new ReasoningVisualizer();
  });

  describe('initialize', () => {
    it('sets max iterations and resets counters', () => {
      visualizer.initialize(10);
      visualizer.updateIteration(5);
      visualizer.updateFilesRead(3);
      visualizer.initialize(20);
      visualizer.updateIteration(1);
      expect(visualizer).toBeDefined();
      // State is internal; we test that showIterationStatus uses it without throwing
      visualizer.showIterationStatus('read_file', 'Some reasoning');
    });
  });

  describe('updateIteration', () => {
    it('allows updating iteration for progress display', () => {
      visualizer.initialize(5);
      visualizer.updateIteration(2);
      visualizer.showIterationStatus('analyze_code', 'Analyzing...');
      // No throw means iteration was used
    });
  });

  describe('updateTodoStats', () => {
    it('allows updating todo stats', () => {
      visualizer.initialize(3);
      visualizer.updateTodoStats({
        total: 2,
        pending: 1,
        in_progress: 1,
        completed: 0,
      });
      visualizer.showTodoStatus();
      // No throw
    });
  });

  describe('showHeader', () => {
    it('calls logInfo with question', () => {
      const { logInfo } = require('../logger');
      (logInfo as jest.Mock).mockClear();
      visualizer.showHeader('What is X?');
      expect(logInfo).toHaveBeenCalled();
      const calls = (logInfo as jest.Mock).mock.calls;
      const concat = calls.map((c: string[]) => c[0]).join(' ');
      expect(concat).toContain('What is X?');
    });
  });

  describe('showCompletion', () => {
    it('calls logInfo', () => {
      const { logInfo } = require('../logger');
      (logInfo as jest.Mock).mockClear();
      visualizer.initialize(5);
      visualizer.updateIteration(5);
      visualizer.showCompletion();
      expect(logInfo).toHaveBeenCalled();
    });
  });

  describe('showActionResult', () => {
    it('logs success message', () => {
      const { logInfo } = require('../logger');
      (logInfo as jest.Mock).mockClear();
      visualizer.showActionResult('read_file', {
        success: true,
        message: 'File read',
      });
      expect(logInfo).toHaveBeenCalledWith(expect.stringContaining('File read'));
    });

    it('logs details when provided', () => {
      const { logInfo } = require('../logger');
      (logInfo as jest.Mock).mockClear();
      visualizer.showActionResult('analyze_code', {
        success: false,
        message: 'Failed',
        details: ['Detail 1', 'Detail 2'],
      });
      expect(logInfo).toHaveBeenCalled();
      const calls = (logInfo as jest.Mock).mock.calls;
      const all = calls.flat().join(' ');
      expect(all).toContain('Detail 1');
      expect(all).toContain('Detail 2');
    });
  });
});
