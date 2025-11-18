/**
 * Tests for Report Intent Tool
 */

import { ReportIntentTool } from '../report_intent_tool';
import { ConfidenceLevel } from '../../../reasoning/intent_classifier/types';

describe('ReportIntentTool', () => {
  let tool: ReportIntentTool;
  let reportedIntent: {
    shouldApplyChanges: boolean;
    reasoning: string;
    confidence: ConfidenceLevel;
  } | null;

  beforeEach(() => {
    reportedIntent = null;
    tool = new ReportIntentTool({
      onIntentReported: (shouldApplyChanges, reasoning, confidence) => {
        reportedIntent = { shouldApplyChanges, reasoning, confidence };
      }
    });
  });

  describe('getName', () => {
    it('should return correct tool name', () => {
      expect(tool.getName()).toBe('report_intent');
    });
  });

  describe('getDescription', () => {
    it('should return description', () => {
      const description = tool.getDescription();
      expect(description).toBeDefined();
      expect(typeof description).toBe('string');
      expect(description.length).toBeGreaterThan(0);
    });
  });

  describe('getInputSchema', () => {
    it('should return valid input schema', () => {
      const schema = tool.getInputSchema();
      expect(schema).toBeDefined();
      expect(schema.type).toBe('object');
      expect(schema.properties).toBeDefined();
      expect(schema.required).toContain('shouldApplyChanges');
      expect(schema.required).toContain('reasoning');
      expect(schema.required).toContain('confidence');
    });

    it('should have shouldApplyChanges as boolean', () => {
      const schema = tool.getInputSchema();
      expect(schema.properties.shouldApplyChanges.type).toBe('boolean');
    });

    it('should have reasoning as string', () => {
      const schema = tool.getInputSchema();
      expect(schema.properties.reasoning.type).toBe('string');
    });

    it('should have confidence enum', () => {
      const schema = tool.getInputSchema();
      expect(schema.properties.confidence.enum).toEqual(Object.values(ConfidenceLevel));
    });
  });

  describe('execute', () => {
    it('should report intent with valid input', async () => {
      const result = await tool.execute({
        shouldApplyChanges: true,
        reasoning: 'User wants to create a file',
        confidence: 'high'
      });

      expect(result).toContain('Successfully reported');
      expect(reportedIntent).not.toBeNull();
      expect(reportedIntent!.shouldApplyChanges).toBe(true);
      expect(reportedIntent!.reasoning).toBe('User wants to create a file');
      expect(reportedIntent!.confidence).toBe('high');
    });

    it('should handle false shouldApplyChanges', async () => {
      const result = await tool.execute({
        shouldApplyChanges: false,
        reasoning: 'User is asking a question',
        confidence: 'medium'
      });

      expect(reportedIntent).not.toBeNull();
      expect(reportedIntent!.shouldApplyChanges).toBe(false);
      expect(reportedIntent!.confidence).toBe('medium');
    });

    it('should clean markdown from reasoning', async () => {
      await tool.execute({
        shouldApplyChanges: true,
        reasoning: '**Bold** and *italic* text with # heading at start',
        confidence: 'high'
      });

      expect(reportedIntent).not.toBeNull();
      expect(reportedIntent!.reasoning).not.toContain('**');
      expect(reportedIntent!.reasoning).not.toContain('*');
      // # is only removed at start of line, not in middle of text
      expect(reportedIntent!.reasoning).toContain('heading at start');
    });

    it('should throw error if shouldApplyChanges is missing', async () => {
      await expect(tool.execute({
        reasoning: 'Test',
        confidence: 'high'
      })).rejects.toThrow('shouldApplyChanges is required');
    });

    it('should throw error if reasoning is missing', async () => {
      await expect(tool.execute({
        shouldApplyChanges: true,
        confidence: 'high'
      })).rejects.toThrow('reasoning is required');
    });

    it('should throw error if confidence is missing', async () => {
      await expect(tool.execute({
        shouldApplyChanges: true,
        reasoning: 'Test'
      })).rejects.toThrow('confidence is required');
    });

    it('should throw error if confidence is invalid', async () => {
      await expect(tool.execute({
        shouldApplyChanges: true,
        reasoning: 'Test',
        confidence: 'invalid'
      })).rejects.toThrow('confidence must be one of');
    });

    it('should handle confidence case insensitively', async () => {
      await tool.execute({
        shouldApplyChanges: true,
        reasoning: 'Test',
        confidence: 'HIGH'
      });

      expect(reportedIntent).not.toBeNull();
      expect(reportedIntent!.confidence).toBe('high');
    });
  });
});

