/**
 * Tests for Report Errors Tool
 */

import { ReportErrorsTool } from '../report_errors_tool';
import { IssueType, SeverityLevel } from '../../../reasoning/error_detector/types';

describe('ReportErrorsTool', () => {
  let tool: ReportErrorsTool;
  let reportedErrors: any[] | null;

  beforeEach(() => {
    reportedErrors = null;
    tool = new ReportErrorsTool({
      onErrorsReported: (errors) => {
        reportedErrors = errors;
      }
    });
  });

  describe('getName', () => {
    it('should return correct tool name', () => {
      expect(tool.getName()).toBe('report_errors');
    });
  });

  describe('getDescription', () => {
    it('should return description', () => {
      const description = tool.getDescription();
      expect(description).toBeDefined();
      expect(typeof description).toBe('string');
      expect(description.length).toBeGreaterThan(0);
      expect(description).toContain('error');
    });
  });

  describe('getInputSchema', () => {
    it('should return valid input schema', () => {
      const schema = tool.getInputSchema();
      expect(schema).toBeDefined();
      expect(schema.type).toBe('object');
      expect(schema.properties).toBeDefined();
      expect(schema.required).toContain('errors');
    });

    it('should have errors as array', () => {
      const schema = tool.getInputSchema();
      expect(schema.properties.errors.type).toBe('array');
    });
  });

  describe('execute', () => {
    it('should report errors with valid input', async () => {
      const result = await tool.execute({
        errors: [
          {
            file: 'src/utils.ts',
            line: 42,
            type: IssueType.BUG,
            severity: SeverityLevel.HIGH,
            description: 'Null pointer exception',
            suggestion: 'Add null check'
          }
        ]
      });

      expect(result).toContain('Successfully reported');
      expect(reportedErrors).not.toBeNull();
      expect(reportedErrors!.length).toBe(1);
      expect(reportedErrors![0].file).toBe('src/utils.ts');
      expect(reportedErrors![0].line).toBe(42);
      expect(reportedErrors![0].type).toBe(IssueType.BUG);
      expect(reportedErrors![0].severity).toBe(SeverityLevel.HIGH);
    });

    it('should handle empty errors array', async () => {
      const result = await tool.execute({
        errors: []
      });

      expect(result).toContain('No errors to report');
      expect(reportedErrors).not.toBeNull();
      expect(reportedErrors!.length).toBe(0);
    });

    it('should clean markdown from file path', async () => {
      await tool.execute({
        errors: [
          {
            file: '**src/utils.ts**',
            type: IssueType.BUG,
            severity: SeverityLevel.HIGH,
            description: 'Error'
          }
        ]
      });

      expect(reportedErrors![0].file).toBe('src/utils.ts');
      expect(reportedErrors![0].file).not.toContain('**');
    });

    it('should clean markdown from description', async () => {
      await tool.execute({
        errors: [
          {
            file: 'src/utils.ts',
            type: IssueType.BUG,
            severity: SeverityLevel.HIGH,
            description: '**Bold** and *italic* text'
          }
        ]
      });

      expect(reportedErrors![0].description).not.toContain('**');
      expect(reportedErrors![0].description).not.toContain('*');
    });

    it('should normalize issue type to lowercase', async () => {
      await tool.execute({
        errors: [
          {
            file: 'src/utils.ts',
            type: 'BUG',
            severity: SeverityLevel.HIGH,
            description: 'Error'
          }
        ]
      });

      expect(reportedErrors![0].type).toBe(IssueType.BUG);
    });

    it('should normalize severity to lowercase', async () => {
      await tool.execute({
        errors: [
          {
            file: 'src/utils.ts',
            type: IssueType.BUG,
            severity: 'HIGH',
            description: 'Error'
          }
        ]
      });

      expect(reportedErrors![0].severity).toBe(SeverityLevel.HIGH);
    });

    it('should parse line number from string', async () => {
      await tool.execute({
        errors: [
          {
            file: 'src/utils.ts',
            line: '42',
            type: IssueType.BUG,
            severity: SeverityLevel.HIGH,
            description: 'Error'
          }
        ]
      });

      expect(reportedErrors![0].line).toBe(42);
    });

    it('should handle optional suggestion', async () => {
      await tool.execute({
        errors: [
          {
            file: 'src/utils.ts',
            type: IssueType.BUG,
            severity: SeverityLevel.HIGH,
            description: 'Error',
            suggestion: 'Fix it'
          }
        ]
      });

      expect(reportedErrors![0].suggestion).toBe('Fix it');
    });

    it('should throw error if errors is not an array', async () => {
      await expect(tool.execute({
        errors: 'not an array'
      })).rejects.toThrow('errors must be an array');
    });

    it('should throw error if required fields are missing', async () => {
      await expect(tool.execute({
        errors: [
          {
            file: 'src/utils.ts'
            // Missing type, severity, description
          }
        ]
      })).rejects.toThrow('must have file, type, severity, and description fields');
    });

    it('should throw error if severity is invalid', async () => {
      await expect(tool.execute({
        errors: [
          {
            file: 'src/utils.ts',
            type: IssueType.BUG,
            severity: 'invalid',
            description: 'Error'
          }
        ]
      })).rejects.toThrow('Invalid severity');
    });

    it('should fallback to CODE_ISSUE for invalid type', async () => {
      await tool.execute({
        errors: [
          {
            file: 'src/utils.ts',
            type: 'INVALID_TYPE',
            severity: SeverityLevel.HIGH,
            description: 'Error'
          }
        ]
      });

      expect(reportedErrors![0].type).toBe(IssueType.CODE_ISSUE);
    });

    it('should handle multiple errors', async () => {
      await tool.execute({
        errors: [
          {
            file: 'src/utils.ts',
            type: IssueType.BUG,
            severity: SeverityLevel.HIGH,
            description: 'Error 1'
          },
          {
            file: 'src/helper.ts',
            type: IssueType.SECURITY_VULNERABILITY,
            severity: SeverityLevel.CRITICAL,
            description: 'Error 2'
          }
        ]
      });

      expect(reportedErrors!.length).toBe(2);
      expect(reportedErrors![0].file).toBe('src/utils.ts');
      expect(reportedErrors![1].file).toBe('src/helper.ts');
    });
  });
});

