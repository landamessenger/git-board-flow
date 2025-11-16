/**
 * Tests for System Prompt Builder
 */

import { SystemPromptBuilder } from '../system_prompt_builder';
import { ProgressDetectionOptions } from '../types';

describe('SystemPromptBuilder', () => {
  describe('build', () => {
    it('should build prompt with default options', () => {
      const options: ProgressDetectionOptions = {
        apiKey: 'test-key',
        repositoryOwner: 'owner',
        repositoryName: 'repo',
        repositoryBranch: 'branch'
      };

      const prompt = SystemPromptBuilder.build(options);

      expect(prompt).toContain('expert code reviewer');
      expect(prompt).toContain('task progress assessor');
      expect(prompt).toContain('progress percentage');
    });

    it('should include issue number when provided', () => {
      const options: ProgressDetectionOptions = {
        apiKey: 'test-key',
        repositoryOwner: 'owner',
        repositoryName: 'repo',
        repositoryBranch: 'branch',
        issueNumber: 123
      };

      const prompt = SystemPromptBuilder.build(options);

      expect(prompt).toContain('Issue #123');
    });

    it('should include issue description when provided', () => {
      const options: ProgressDetectionOptions = {
        apiKey: 'test-key',
        repositoryOwner: 'owner',
        repositoryName: 'repo',
        repositoryBranch: 'branch',
        issueDescription: 'Implement new feature X'
      };

      const prompt = SystemPromptBuilder.build(options);

      expect(prompt).toContain('Implement new feature X');
      expect(prompt).toContain('Task Description');
    });

    it('should include changed files when provided', () => {
      const options: ProgressDetectionOptions = {
        apiKey: 'test-key',
        repositoryOwner: 'owner',
        repositoryName: 'repo',
        repositoryBranch: 'branch',
        changedFiles: [
          {
            filename: 'src/test.ts',
            status: 'modified',
            additions: 10,
            deletions: 5
          },
          {
            filename: 'src/other.ts',
            status: 'added'
          }
        ]
      };

      const prompt = SystemPromptBuilder.build(options);

      expect(prompt).toContain('Changed Files (2)');
      expect(prompt).toContain('src/test.ts');
      expect(prompt).toContain('src/other.ts');
      expect(prompt).toContain('modified');
      expect(prompt).toContain('added');
    });

    it('should handle no changed files', () => {
      const options: ProgressDetectionOptions = {
        apiKey: 'test-key',
        repositoryOwner: 'owner',
        repositoryName: 'repo',
        repositoryBranch: 'branch',
        changedFiles: []
      };

      const prompt = SystemPromptBuilder.build(options);

      expect(prompt).toContain('No files have been changed yet');
    });

    it('should include report_progress tool instructions', () => {
      const options: ProgressDetectionOptions = {
        apiKey: 'test-key',
        repositoryOwner: 'owner',
        repositoryName: 'repo',
        repositoryBranch: 'branch'
      };

      const prompt = SystemPromptBuilder.build(options);

      expect(prompt).toContain('report_progress');
      expect(prompt).toContain('CRITICAL - REPORTING PROGRESS');
      expect(prompt).toContain('DO NOT provide progress in text format');
    });

    it('should include instructions to read all changed files', () => {
      const options: ProgressDetectionOptions = {
        apiKey: 'test-key',
        repositoryOwner: 'owner',
        repositoryName: 'repo',
        repositoryBranch: 'branch',
        changedFiles: [
          {
            filename: 'src/test.ts',
            status: 'modified'
          }
        ]
      };

      const prompt = SystemPromptBuilder.build(options);

      expect(prompt).toContain('read ALL changed files');
      expect(prompt).toContain('read_file');
    });

    it('should include example of report_progress usage', () => {
      const options: ProgressDetectionOptions = {
        apiKey: 'test-key',
        repositoryOwner: 'owner',
        repositoryName: 'repo',
        repositoryBranch: 'branch'
      };

      const prompt = SystemPromptBuilder.build(options);

      expect(prompt).toContain('report_progress({');
      expect(prompt).toContain('progress:');
      expect(prompt).toContain('summary:');
    });

    it('should include all required instructions', () => {
      const options: ProgressDetectionOptions = {
        apiKey: 'test-key',
        repositoryOwner: 'owner',
        repositoryName: 'repo',
        repositoryBranch: 'branch',
        issueNumber: 456,
        issueDescription: 'Fix bug in authentication',
        changedFiles: [
          {
            filename: 'src/auth.ts',
            status: 'modified'
          }
        ]
      };

      const prompt = SystemPromptBuilder.build(options);

      expect(prompt).toContain('Issue #456');
      expect(prompt).toContain('Fix bug in authentication');
      expect(prompt).toContain('src/auth.ts');
      expect(prompt).toContain('CRITICAL INSTRUCTIONS');
      expect(prompt).toContain('report_progress tool');
    });

    it('should handle missing issue description gracefully', () => {
      const options: ProgressDetectionOptions = {
        apiKey: 'test-key',
        repositoryOwner: 'owner',
        repositoryName: 'repo',
        repositoryBranch: 'branch',
        issueNumber: 789
      };

      const prompt = SystemPromptBuilder.build(options);

      expect(prompt).toContain('Issue #789');
      // Should not contain Task Description section if description is missing
      expect(prompt).not.toContain('Task Description:');
    });
  });
});

