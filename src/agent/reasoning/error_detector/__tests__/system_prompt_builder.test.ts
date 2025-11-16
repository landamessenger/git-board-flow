/**
 * Tests for System Prompt Builder
 */

import { SystemPromptBuilder } from '../system_prompt_builder';
import { ErrorDetectionOptions } from '../types';

describe('SystemPromptBuilder', () => {
  describe('build', () => {
    it('should build prompt with default options', () => {
      const options: ErrorDetectionOptions = {
        apiKey: 'test-key'
      };

      const prompt = SystemPromptBuilder.build(options);

      expect(prompt).toContain('expert code reviewer');
      expect(prompt).toContain('error detector');
      expect(prompt).toContain('Analyze the entire codebase');
      expect(prompt).toContain('all types of errors');
    });

    it('should include focus areas when provided', () => {
      const options: ErrorDetectionOptions = {
        apiKey: 'test-key',
        focusAreas: ['src/agent', 'src/utils']
      };

      const prompt = SystemPromptBuilder.build(options);

      expect(prompt).toContain('Focus on these areas: src/agent, src/utils');
      expect(prompt).not.toContain('Analyze the entire codebase');
    });

    it('should include error types when provided', () => {
      const options: ErrorDetectionOptions = {
        apiKey: 'test-key',
        errorTypes: ['type-errors', 'security-issues']
      };

      const prompt = SystemPromptBuilder.build(options);

      expect(prompt).toContain('Look for these types of errors: type-errors, security-issues');
      expect(prompt).not.toContain('all types of errors');
    });

    it('should include both focus areas and error types', () => {
      const options: ErrorDetectionOptions = {
        apiKey: 'test-key',
        focusAreas: ['src/agent'],
        errorTypes: ['type-errors']
      };

      const prompt = SystemPromptBuilder.build(options);

      expect(prompt).toContain('Focus on these areas: src/agent');
      expect(prompt).toContain('Look for these types of errors: type-errors');
    });

    it('should include mandatory workflow instructions', () => {
      const options: ErrorDetectionOptions = {
        apiKey: 'test-key'
      };

      const prompt = SystemPromptBuilder.build(options);

      expect(prompt).toContain('MANDATORY WORKFLOW');
      expect(prompt).toContain('search_files');
      expect(prompt).toContain('read_file');
    });

    it('should include error severity levels', () => {
      const options: ErrorDetectionOptions = {
        apiKey: 'test-key'
      };

      const prompt = SystemPromptBuilder.build(options);

      expect(prompt).toContain('critical');
      expect(prompt).toContain('high');
      expect(prompt).toContain('medium');
      expect(prompt).toContain('low');
    });

    it('should include output format instructions', () => {
      const options: ErrorDetectionOptions = {
        apiKey: 'test-key'
      };

      const prompt = SystemPromptBuilder.build(options);

      expect(prompt).toContain('Output Format');
      expect(prompt).toContain('File:');
      expect(prompt).toContain('Line:');
      expect(prompt).toContain('Type:');
      expect(prompt).toContain('Severity:');
    });
  });
});

