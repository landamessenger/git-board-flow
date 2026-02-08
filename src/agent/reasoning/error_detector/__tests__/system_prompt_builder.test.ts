/**
 * Tests for System Prompt Builder
 */

import { SystemPromptBuilder } from '../system_prompt_builder';
import { ErrorDetectionOptions, IssueType } from '../types';

describe('SystemPromptBuilder', () => {
  describe('build', () => {
    it('should build prompt with default options', () => {
      const options: ErrorDetectionOptions = {
        serverUrl: 'http://localhost:4096'
      };

      const prompt = SystemPromptBuilder.build(options);

      expect(prompt).toContain('expert code reviewer');
      expect(prompt).toContain('bug detector');
      expect(prompt).toContain('Analyze the entire codebase');
      expect(prompt).toContain('all types of issues');
    });

    it('should include focus areas when provided', () => {
      const options: ErrorDetectionOptions = {
        serverUrl: 'http://localhost:4096',
        focusAreas: ['src/agent', 'src/utils']
      };

      const prompt = SystemPromptBuilder.build(options);

      expect(prompt).toContain('Focus on these areas: src/agent, src/utils');
      expect(prompt).not.toContain('Analyze the entire codebase');
    });

    it('should include error types when provided', () => {
      const options: ErrorDetectionOptions = {
        serverUrl: 'http://localhost:4096',
        errorTypes: [IssueType.TYPE_ERROR, IssueType.SECURITY_VULNERABILITY]
      };

      const prompt = SystemPromptBuilder.build(options);

      expect(prompt).toContain(`Look for these types of issues: ${IssueType.TYPE_ERROR}, ${IssueType.SECURITY_VULNERABILITY}`);
    });

    it('should include both focus areas and error types', () => {
      const options: ErrorDetectionOptions = {
        serverUrl: 'http://localhost:4096',
        focusAreas: ['src/agent'],
        errorTypes: [IssueType.TYPE_ERROR]
      };

      const prompt = SystemPromptBuilder.build(options);

      expect(prompt).toContain('Focus on these areas: src/agent');
      expect(prompt).toContain(`Look for these types of issues: ${IssueType.TYPE_ERROR}`);
    });

    it('should include mandatory workflow instructions', () => {
      const options: ErrorDetectionOptions = {
        serverUrl: 'http://localhost:4096'
      };

      const prompt = SystemPromptBuilder.build(options);

      expect(prompt).toContain('MANDATORY WORKFLOW');
      expect(prompt).toContain('search_files');
      expect(prompt).toContain('read_file');
    });

    it('should include error severity levels', () => {
      const options: ErrorDetectionOptions = {
        serverUrl: 'http://localhost:4096'
      };

      const prompt = SystemPromptBuilder.build(options);

      expect(prompt).toContain('critical');
      expect(prompt).toContain('high');
      expect(prompt).toContain('medium');
      expect(prompt).toContain('low');
    });

    it('should include output format instructions', () => {
      const options: ErrorDetectionOptions = {
        serverUrl: 'http://localhost:4096'
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

