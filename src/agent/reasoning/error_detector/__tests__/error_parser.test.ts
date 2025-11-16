/**
 * Tests for Error Parser
 */

import { ErrorParser } from '../error_parser';
import { AgentResult } from '../../../types';
import { DetectedError, IssueType } from '../types';

describe('ErrorParser', () => {
  describe('parseErrors', () => {
    it('should parse errors from report_errors tool calls', () => {
      const result: AgentResult = {
        finalResponse: '',
        turns: [],
        toolCalls: [
          {
            id: 'tool-call-1',
            name: 'report_errors',
            input: {
              errors: [
                {
                  file: 'src/test.ts',
                  line: 10,
                  type: IssueType.TYPE_ERROR,
                  severity: 'high',
                  description: 'Type mismatch error',
                  suggestion: 'Fix the type annotation'
                }
              ]
            }
          }
        ],
        messages: []
      };

      const errors = ErrorParser.parseErrors(result);

      expect(errors.length).toBe(1);
      const error = errors[0];
      expect(error.file).toBe('src/test.ts');
      expect(error.severity).toBe('high');
      expect(error.type).toBe(IssueType.TYPE_ERROR);
    });

    it('should parse multiple errors from report_errors tool', () => {
      const result: AgentResult = {
        finalResponse: '',
        turns: [],
        toolCalls: [
          {
            id: 'tool-call-1',
            name: 'report_errors',
            input: {
              errors: [
                {
                  file: 'src/test.ts',
                  type: IssueType.BUG,
                  severity: 'critical',
                  description: 'Critical bug found'
                },
                {
                  file: 'src/other.ts',
                  type: IssueType.LOGIC_ERROR,
                  severity: 'high',
                  description: 'Logic error detected'
                }
              ]
            }
          }
        ],
        messages: []
      };

      const errors = ErrorParser.parseErrors(result);

      expect(errors.length).toBe(2);
      expect(errors[0].file).toBe('src/test.ts');
      expect(errors[0].type).toBe(IssueType.BUG);
      expect(errors[1].file).toBe('src/other.ts');
      expect(errors[1].type).toBe(IssueType.LOGIC_ERROR);
    });

    it('should handle errors with different severities', () => {
      const result: AgentResult = {
        finalResponse: '',
        turns: [],
        toolCalls: [
          {
            id: 'tool-call-2',
            name: 'report_errors',
            input: {
              errors: [
                {
                  file: 'src/test.ts',
                  type: IssueType.SECURITY_VULNERABILITY,
                  severity: 'critical',
                  description: 'Critical security issue'
                }
              ]
            }
          }
        ],
        messages: []
      };

      const errors = ErrorParser.parseErrors(result);

      expect(errors.length).toBe(1);
      expect(errors[0].severity).toBe('critical');
      expect(errors[0].type).toBe(IssueType.SECURITY_VULNERABILITY);
      expect(errors[0].file).toBe('src/test.ts');
    });

    it('should ignore non-report_errors tool calls', () => {
      const result: AgentResult = {
        finalResponse: '',
        turns: [],
        toolCalls: [
          {
            id: 'tool-call-3',
            name: 'read_file',
            input: {
              file_path: 'src/test.ts'
            }
          }
        ],
        messages: []
      };

      const errors = ErrorParser.parseErrors(result);

      expect(errors.length).toBe(0);
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

    it('should parse multiple errors from single report_errors call', () => {
      const result: AgentResult = {
        finalResponse: '',
        turns: [],
        toolCalls: [
          {
            id: 'tool-call-4',
            name: 'report_errors',
            input: {
              errors: [
                {
                  file: 'src/file1.ts',
                  line: 5,
                  type: IssueType.TYPE_ERROR,
                  severity: 'critical',
                  description: 'First error'
                },
                {
                  file: 'src/file2.ts',
                  line: 10,
                  type: IssueType.LOGIC_ERROR,
                  severity: 'high',
                  description: 'Second error'
                }
              ]
            }
          }
        ],
        messages: []
      };

      const errors = ErrorParser.parseErrors(result);

      expect(errors.length).toBe(2);
      expect(errors[0].type).toBe(IssueType.TYPE_ERROR);
      expect(errors[1].type).toBe(IssueType.LOGIC_ERROR);
    });

    it('should handle empty errors array', () => {
      const result: AgentResult = {
        finalResponse: '',
        turns: [],
        toolCalls: [
          {
            id: 'tool-call-5',
            name: 'report_errors',
            input: {
              errors: []
            }
          }
        ],
        messages: []
      };

      const errors = ErrorParser.parseErrors(result);

      expect(errors.length).toBe(0);
    });

    it('should convert invalid type strings to valid IssueType', () => {
      const result: AgentResult = {
        finalResponse: '',
        turns: [],
        toolCalls: [
          {
            id: 'tool-call-6',
            name: 'report_errors',
            input: {
              errors: [
                {
                  file: 'src/test.ts',
                  type: 'invalid-type', // Invalid type
                  severity: 'high',
                  description: 'Test error'
                }
              ]
            }
          }
        ],
        messages: []
      };

      const errors = ErrorParser.parseErrors(result);

      expect(errors.length).toBe(1);
      // Should fallback to CODE_ISSUE or find a close match
      expect(Object.values(IssueType)).toContain(errors[0].type);
    });
  });
});

