/**
 * Tests for Progress Parser
 */

import { ProgressParser } from '../progress_parser';
import { AgentResult } from '../../../types';

describe('ProgressParser', () => {
  describe('parseProgress', () => {
    it('should parse progress from report_progress tool calls', () => {
      const result: AgentResult = {
        finalResponse: '',
        turns: [],
        toolCalls: [
          {
            id: 'tool-call-1',
            name: 'report_progress',
            input: {
              progress: 75,
              summary: 'Core functionality implemented, tests pending'
            }
          }
        ],
        messages: []
      };

      const parsed = ProgressParser.parseProgress(result);

      expect(parsed.progress).toBe(75);
      expect(parsed.summary).toBe('Core functionality implemented, tests pending');
    });

    it('should handle progress as string number', () => {
      const result: AgentResult = {
        finalResponse: '',
        turns: [],
        toolCalls: [
          {
            id: 'tool-call-1',
            name: 'report_progress',
            input: {
              progress: '80',
              summary: 'Mostly complete'
            }
          }
        ],
        messages: []
      };

      const parsed = ProgressParser.parseProgress(result);

      expect(parsed.progress).toBe(80);
      expect(parsed.summary).toBe('Mostly complete');
    });

    it('should round progress to integer', () => {
      const result: AgentResult = {
        finalResponse: '',
        turns: [],
        toolCalls: [
          {
            id: 'tool-call-1',
            name: 'report_progress',
            input: {
              progress: 75.7,
              summary: 'Almost done'
            }
          }
        ],
        messages: []
      };

      const parsed = ProgressParser.parseProgress(result);

      expect(parsed.progress).toBe(76);
    });

    it('should handle progress at boundaries', () => {
      const result0: AgentResult = {
        finalResponse: '',
        turns: [],
        toolCalls: [
          {
            id: 'tool-call-1',
            name: 'report_progress',
            input: {
              progress: 0,
              summary: 'Nothing done'
            }
          }
        ],
        messages: []
      };

      const result100: AgentResult = {
        finalResponse: '',
        turns: [],
        toolCalls: [
          {
            id: 'tool-call-2',
            name: 'report_progress',
            input: {
              progress: 100,
              summary: 'Complete'
            }
          }
        ],
        messages: []
      };

      const parsed0 = ProgressParser.parseProgress(result0);
      const parsed100 = ProgressParser.parseProgress(result100);

      expect(parsed0.progress).toBe(0);
      expect(parsed100.progress).toBe(100);
    });

    it('should ignore non-report_progress tool calls', () => {
      const result: AgentResult = {
        finalResponse: '',
        turns: [],
        toolCalls: [
          {
            id: 'tool-call-1',
            name: 'read_file',
            input: {
              file_path: 'src/test.ts'
            }
          }
        ],
        messages: []
      };

      const parsed = ProgressParser.parseProgress(result);

      expect(parsed.progress).toBe(0);
      expect(parsed.summary).toBe('Unable to determine progress from agent response.');
    });

    it('should handle empty result', () => {
      const result: AgentResult = {
        finalResponse: '',
        turns: [],
        toolCalls: [],
        messages: []
      };

      const parsed = ProgressParser.parseProgress(result);

      expect(parsed.progress).toBe(0);
      expect(parsed.summary).toBe('Unable to determine progress from agent response.');
    });

    it('should reject invalid progress values (negative)', () => {
      const result: AgentResult = {
        finalResponse: '',
        turns: [],
        toolCalls: [
          {
            id: 'tool-call-1',
            name: 'report_progress',
            input: {
              progress: -10,
              summary: 'Invalid progress'
            }
          }
        ],
        messages: []
      };

      const parsed = ProgressParser.parseProgress(result);

      expect(parsed.progress).toBe(0);
      expect(parsed.summary).toBe('Unable to determine progress from agent response.');
    });

    it('should reject invalid progress values (over 100)', () => {
      const result: AgentResult = {
        finalResponse: '',
        turns: [],
        toolCalls: [
          {
            id: 'tool-call-1',
            name: 'report_progress',
            input: {
              progress: 150,
              summary: 'Invalid progress'
            }
          }
        ],
        messages: []
      };

      const parsed = ProgressParser.parseProgress(result);

      expect(parsed.progress).toBe(0);
      expect(parsed.summary).toBe('Unable to determine progress from agent response.');
    });

    it('should handle missing summary', () => {
      const result: AgentResult = {
        finalResponse: '',
        turns: [],
        toolCalls: [
          {
            id: 'tool-call-1',
            name: 'report_progress',
            input: {
              progress: 50
            }
          }
        ],
        messages: []
      };

      const parsed = ProgressParser.parseProgress(result);

      expect(parsed.progress).toBe(50);
      expect(parsed.summary).toBe('Unable to determine progress from agent response.');
    });

    it('should handle multiple report_progress calls (use first valid one)', () => {
      const result: AgentResult = {
        finalResponse: '',
        turns: [],
        toolCalls: [
          {
            id: 'tool-call-1',
            name: 'report_progress',
            input: {
              progress: 60,
              summary: 'First assessment'
            }
          },
          {
            id: 'tool-call-2',
            name: 'report_progress',
            input: {
              progress: 80,
              summary: 'Second assessment'
            }
          }
        ],
        messages: []
      };

      const parsed = ProgressParser.parseProgress(result);

      // Should use the first valid one
      expect(parsed.progress).toBe(60);
      expect(parsed.summary).toBe('First assessment');
    });

    it('should handle NaN progress values', () => {
      const result: AgentResult = {
        finalResponse: '',
        turns: [],
        toolCalls: [
          {
            id: 'tool-call-1',
            name: 'report_progress',
            input: {
              progress: NaN,
              summary: 'Invalid'
            }
          }
        ],
        messages: []
      };

      const parsed = ProgressParser.parseProgress(result);

      expect(parsed.progress).toBe(0);
      expect(parsed.summary).toBe('Unable to determine progress from agent response.');
    });
  });
});

