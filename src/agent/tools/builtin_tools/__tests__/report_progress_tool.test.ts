/**
 * Tests for Report Progress Tool
 */

import { ReportProgressTool } from '../report_progress_tool';

describe('ReportProgressTool', () => {
  let tool: ReportProgressTool;
  let onProgressReported: jest.Mock;

  beforeEach(() => {
    onProgressReported = jest.fn();
    tool = new ReportProgressTool({
      onProgressReported
    });
  });

  describe('getName', () => {
    it('should return correct tool name', () => {
      expect(tool.getName()).toBe('report_progress');
    });
  });

  describe('getDescription', () => {
    it('should return tool description', () => {
      const description = tool.getDescription();
      expect(description).toContain('progress');
      expect(description).toContain('percentage');
    });
  });

  describe('getInputSchema', () => {
    it('should return valid JSON schema', () => {
      const schema = tool.getInputSchema();

      expect(schema.type).toBe('object');
      expect(schema.properties).toBeDefined();
      expect(schema.required).toContain('progress');
      expect(schema.required).toContain('summary');
    });

    it('should have progress property with correct constraints', () => {
      const schema = tool.getInputSchema();
      const progressProp = schema.properties.progress;

      expect(progressProp.type).toBe('number');
      expect(progressProp.minimum).toBe(0);
      expect(progressProp.maximum).toBe(100);
    });

    it('should have summary property', () => {
      const schema = tool.getInputSchema();
      const summaryProp = schema.properties.summary;

      expect(summaryProp.type).toBe('string');
    });
  });

  describe('execute', () => {
    it('should execute with valid input', async () => {
      const input = {
        progress: 75,
        summary: 'Core functionality implemented'
      };

      const result = await tool.execute(input);

      expect(result).toContain('Successfully reported progress');
      expect(onProgressReported).toHaveBeenCalledWith(75, 'Core functionality implemented');
    });

    it('should round progress to integer', async () => {
      const input = {
        progress: 75.7,
        summary: 'Almost done'
      };

      await tool.execute(input);

      expect(onProgressReported).toHaveBeenCalledWith(76, 'Almost done');
    });

    it('should handle progress at boundaries', async () => {
      const input0 = {
        progress: 0,
        summary: 'Nothing done'
      };

      const input100 = {
        progress: 100,
        summary: 'Complete'
      };

      await tool.execute(input0);
      await tool.execute(input100);

      expect(onProgressReported).toHaveBeenCalledWith(0, 'Nothing done');
      expect(onProgressReported).toHaveBeenCalledWith(100, 'Complete');
    });

    it('should throw error for missing progress', async () => {
      const input = {
        summary: 'Test summary'
      };

      await expect(tool.execute(input)).rejects.toThrow('progress is required');
    });

    it('should throw error for missing summary', async () => {
      const input = {
        progress: 50
      };

      await expect(tool.execute(input)).rejects.toThrow('summary is required');
    });

    it('should throw error for progress below 0', async () => {
      const input = {
        progress: -10,
        summary: 'Invalid'
      };

      await expect(tool.execute(input)).rejects.toThrow('Progress must be a number between 0 and 100');
    });

    it('should throw error for progress above 100', async () => {
      const input = {
        progress: 150,
        summary: 'Invalid'
      };

      await expect(tool.execute(input)).rejects.toThrow('Progress must be a number between 0 and 100');
    });

    it('should handle progress as string number', async () => {
      const input = {
        progress: '80',
        summary: 'Mostly complete'
      };

      await tool.execute(input);

      expect(onProgressReported).toHaveBeenCalledWith(80, 'Mostly complete');
    });

    it('should clean markdown from summary', async () => {
      const input = {
        progress: 50,
        summary: '**Bold text** and *italic* text'
      };

      await tool.execute(input);

      expect(onProgressReported).toHaveBeenCalledWith(50, 'Bold text and italic text');
    });

    it('should handle empty summary after cleaning', async () => {
      const input = {
        progress: 50,
        summary: '   '
      };

      await expect(tool.execute(input)).rejects.toThrow('summary is required and cannot be empty');
    });

    it('should preserve newlines in summary', async () => {
      const input = {
        progress: 60,
        summary: 'Line 1\\nLine 2'
      };

      await tool.execute(input);

      expect(onProgressReported).toHaveBeenCalledWith(60, 'Line 1\nLine 2');
    });
  });
});

