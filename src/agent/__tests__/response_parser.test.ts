/**
 * Tests for ResponseParser
 */

import { ResponseParser } from '../utils/response_parser';
import { ParsedResponse } from '../types';

describe('ResponseParser', () => {
  describe('parse', () => {
    it('should parse simple response without tool calls', () => {
      const response = {
        response: 'Hello, how can I help?'
      };

      const parsed = ResponseParser.parse(response);

      expect(parsed.text).toBe('Hello, how can I help?');
      expect(parsed.toolCalls).toEqual([]);
    });

    it('should parse response with reasoning', () => {
      const response = {
        reasoning: 'I need to check the file first',
        response: 'Let me read that file for you'
      };

      const parsed = ResponseParser.parse(response);

      expect(parsed.text).toBe('Let me read that file for you');
      expect(parsed.reasoning).toBe('I need to check the file first');
    });

    it('should parse response with tool calls', () => {
      const response = {
        response: 'I will read the file',
        tool_calls: [
          {
            id: 'call_1',
            name: 'read_file',
            input: { file_path: 'test.ts' }
          }
        ]
      };

      const parsed = ResponseParser.parse(response);

      expect(parsed.text).toBe('I will read the file');
      expect(parsed.toolCalls).toHaveLength(1);
      expect(parsed.toolCalls![0]).toEqual({
        id: 'call_1',
        name: 'read_file',
        input: { file_path: 'test.ts' }
      });
    });

    it('should parse response with multiple tool calls', () => {
      const response = {
        response: 'I will read multiple files',
        tool_calls: [
          {
            id: 'call_1',
            name: 'read_file',
            input: { file_path: 'file1.ts' }
          },
          {
            id: 'call_2',
            name: 'read_file',
            input: { file_path: 'file2.ts' }
          }
        ]
      };

      const parsed = ResponseParser.parse(response);

      expect(parsed.toolCalls).toHaveLength(2);
      expect(parsed.toolCalls![0].id).toBe('call_1');
      expect(parsed.toolCalls![1].id).toBe('call_2');
    });

    it('should generate IDs for tool calls without id', () => {
      const response = {
        response: 'Test',
        tool_calls: [
          {
            name: 'read_file',
            input: { file_path: 'test.ts' }
          }
        ]
      };

      const parsed = ResponseParser.parse(response);

      expect(parsed.toolCalls).toHaveLength(1);
      expect(parsed.toolCalls![0].id).toBeDefined();
      expect(parsed.toolCalls![0].id).toContain('call_');
    });

    it('should handle empty tool_calls array', () => {
      const response = {
        response: 'No tools needed',
        tool_calls: []
      };

      const parsed = ResponseParser.parse(response);

      expect(parsed.text).toBe('No tools needed');
      expect(parsed.toolCalls).toEqual([]);
    });

    it('should handle missing tool_calls field', () => {
      const response = {
        response: 'Simple response'
      };

      const parsed = ResponseParser.parse(response);

      expect(parsed.text).toBe('Simple response');
      expect(parsed.toolCalls).toEqual([]);
    });

    it('should throw error for invalid response format', () => {
      expect(() => ResponseParser.parse(null)).toThrow();
      expect(() => ResponseParser.parse(undefined)).toThrow();
      expect(() => ResponseParser.parse('string')).toThrow();
    });

    it('should throw error for tool call without name', () => {
      const response = {
        response: 'Test',
        tool_calls: [
          {
            id: 'call_1',
            input: { file_path: 'test.ts' }
          }
        ]
      };

      expect(() => ResponseParser.parse(response)).toThrow('missing \'name\' field');
    });

    it('should use input or arguments field', () => {
      const response1 = {
        response: 'Test',
        tool_calls: [
          {
            id: 'call_1',
            name: 'read_file',
            input: { file_path: 'test.ts' }
          }
        ]
      };

      const response2 = {
        response: 'Test',
        tool_calls: [
          {
            id: 'call_1',
            name: 'read_file',
            arguments: { file_path: 'test.ts' }
          }
        ]
      };

      const parsed1 = ResponseParser.parse(response1);
      const parsed2 = ResponseParser.parse(response2);

      expect(parsed1.toolCalls![0].input).toEqual({ file_path: 'test.ts' });
      expect(parsed2.toolCalls![0].input).toEqual({ file_path: 'test.ts' });
    });
  });

  describe('validate', () => {
    it('should validate correct response', () => {
      const parsed: ParsedResponse = {
        text: 'Hello',
        toolCalls: []
      };

      expect(ResponseParser.validate(parsed)).toBe(true);
    });

    it('should validate response with tool calls', () => {
      const parsed: ParsedResponse = {
        text: 'Hello',
        toolCalls: [
          {
            id: 'call_1',
            name: 'read_file',
            input: {}
          }
        ]
      };

      expect(ResponseParser.validate(parsed)).toBe(true);
    });

    it('should invalidate response without text or tool calls', () => {
      const parsed: ParsedResponse = {
        text: '',
        toolCalls: []
      };

      expect(ResponseParser.validate(parsed)).toBe(false);
    });

    it('should invalidate response with invalid tool call', () => {
      const parsed: ParsedResponse = {
        text: 'Hello',
        toolCalls: [
          {
            id: '',
            name: 'read_file',
            input: {}
          }
        ]
      };

      expect(ResponseParser.validate(parsed)).toBe(false);
    });

    it('should invalidate response with tool call without name', () => {
      const parsed: ParsedResponse = {
        text: 'Hello',
        toolCalls: [
          {
            id: 'call_1',
            name: '',
            input: {}
          }
        ]
      };

      expect(ResponseParser.validate(parsed)).toBe(false);
    });
  });
});

