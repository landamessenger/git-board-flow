/**
 * Tests for Error Parser
 */

import { ErrorParser } from '../error_parser';
import { AgentResult } from '../../../types';
import { DetectedError } from '../types';

describe('ErrorParser', () => {
  describe('parseErrors', () => {
    it('should parse errors from agent messages', () => {
      const result: AgentResult = {
        finalResponse: '',
        turns: [],
        toolCalls: [],
        messages: [
          {
            role: 'assistant',
            content: `File: src/test.ts
Line: 10
Type: type-error
Severity: high
Description: Type mismatch error
Suggestion: Fix the type annotation`
          }
        ]
      };

      const errors = ErrorParser.parseErrors(result);

      expect(errors.length).toBeGreaterThan(0);
      const error = errors[0];
      expect(error.file).toContain('test.ts');
      expect(error.severity).toBe('high');
      expect(error.type).toBe('type-error');
    });

    it('should parse errors from TODO tool calls', () => {
      const result: AgentResult = {
        finalResponse: '',
        turns: [],
        toolCalls: [
          {
            id: 'tool-call-1',
            name: 'manage_todos',
            input: {
              action: 'create',
              content: 'Error in file src/test.ts: critical bug found'
            }
          }
        ],
        messages: []
      };

      const errors = ErrorParser.parseErrors(result);

      expect(errors.length).toBeGreaterThan(0);
      const error = errors[0];
      expect(error.description).toContain('Error');
      expect(error.file).toBe('src/test.ts');
    });

    it('should extract severity from TODO content', () => {
      const result: AgentResult = {
        finalResponse: '',
        turns: [],
        toolCalls: [
          {
            id: 'tool-call-2',
            name: 'manage_todos',
            input: {
              action: 'create',
              content: 'Critical error in src/test.ts: security issue'
            }
          }
        ],
        messages: []
      };

      const errors = ErrorParser.parseErrors(result);

      expect(errors.length).toBeGreaterThan(0);
      // Should detect "critical" in the content
      expect(errors[0].description.toLowerCase()).toContain('critical');
      expect(errors[0].severity).toBe('critical');
      expect(errors[0].file).toBe('src/test.ts');
    });

    it('should parse errors from tool results', () => {
      const result: AgentResult = {
        finalResponse: '',
        turns: [
          {
            turnNumber: 1,
            assistantMessage: '',
            toolCalls: [],
            toolResults: [
              {
                toolCallId: 'tool-call-3',
                content: 'proposed change for file src/test.ts: suggested fix for critical error'
              }
            ],
            timestamp: Date.now()
          }
        ],
        toolCalls: [],
        messages: []
      };

      const errors = ErrorParser.parseErrors(result);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].file).toContain('test.ts');
    });

    it('should handle empty result', () => {
      const result: AgentResult = {
        finalResponse: '',
        turns: [],
        toolCalls: [],
        messages: []
      };

      const errors = ErrorParser.parseErrors(result);

      expect(errors).toEqual([]);
    });

    it('should parse multiple errors from structured text', () => {
      const result: AgentResult = {
        finalResponse: '',
        turns: [],
        toolCalls: [],
        messages: [
          {
            role: 'assistant',
            content: `File: src/file1.ts
Line: 5
Type: type-error
Severity: critical
Description: First error

File: src/file2.ts
Line: 10
Type: logic-error
Severity: high
Description: Second error`
          }
        ]
      };

      const errors = ErrorParser.parseErrors(result);

      expect(errors.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle non-error TODOs', () => {
      const result: AgentResult = {
        finalResponse: '',
        turns: [],
        toolCalls: [
          {
            id: 'tool-call-4',
            name: 'manage_todos',
            input: {
              action: 'create',
              content: 'This is just a regular task for implementing a new feature'
            }
          }
        ],
        messages: []
      };

      const errors = ErrorParser.parseErrors(result);

      // Should not parse as error if it doesn't contain error keywords
      expect(errors.length).toBe(0);
    });

    it('should extract file path from "in src/file.ts" pattern', () => {
      const result: AgentResult = {
        finalResponse: '',
        turns: [],
        toolCalls: [
          {
            id: 'tool-call-5',
            name: 'manage_todos',
            input: {
              action: 'create',
              content: 'Logic error in src/actions/common_action.ts: Handle unknown execution types'
            }
          }
        ],
        messages: []
      };

      const errors = ErrorParser.parseErrors(result);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].file).toBe('src/actions/common_action.ts');
      expect(errors[0].type).toBe('logic-error');
    });

    it('should extract file path from direct path pattern', () => {
      const result: AgentResult = {
        finalResponse: '',
        turns: [],
        toolCalls: [
          {
            id: 'tool-call-6',
            name: 'manage_todos',
            input: {
              action: 'create',
              content: 'Type error in src/utils/logger.ts: logError may fail'
            }
          }
        ],
        messages: []
      };

      const errors = ErrorParser.parseErrors(result);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].file).toBe('src/utils/logger.ts');
    });
  });
});

