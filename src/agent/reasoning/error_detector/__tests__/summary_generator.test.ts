/**
 * Tests for Summary Generator
 */

import { SummaryGenerator } from '../summary_generator';
import { DetectedError, IssueType } from '../types';

describe('SummaryGenerator', () => {
  describe('generateSummary', () => {
    it('should generate correct summary for empty errors array', () => {
      const errors: DetectedError[] = [];
      const summary = SummaryGenerator.generateSummary(errors);

      expect(summary.total).toBe(0);
      expect(summary.bySeverity.critical).toBe(0);
      expect(summary.bySeverity.high).toBe(0);
      expect(summary.bySeverity.medium).toBe(0);
      expect(summary.bySeverity.low).toBe(0);
      expect(Object.keys(summary.byType).length).toBe(0);
    });

    it('should generate correct summary with errors of different severities', () => {
      const errors: DetectedError[] = [
        {
          file: 'file1.ts',
          type: IssueType.TYPE_ERROR,
          severity: 'critical',
          description: 'Critical error'
        },
        {
          file: 'file2.ts',
          type: IssueType.LOGIC_ERROR,
          severity: 'high',
          description: 'High error'
        },
        {
          file: 'file3.ts',
          type: IssueType.TYPE_ERROR,
          severity: 'medium',
          description: 'Medium error'
        },
        {
          file: 'file4.ts',
          type: IssueType.SECURITY_VULNERABILITY,
          severity: 'low',
          description: 'Low error'
        }
      ];

      const summary = SummaryGenerator.generateSummary(errors);

      expect(summary.total).toBe(4);
      expect(summary.bySeverity.critical).toBe(1);
      expect(summary.bySeverity.high).toBe(1);
      expect(summary.bySeverity.medium).toBe(1);
      expect(summary.bySeverity.low).toBe(1);
      expect(summary.byType[IssueType.TYPE_ERROR]).toBe(2);
      expect(summary.byType[IssueType.LOGIC_ERROR]).toBe(1);
      expect(summary.byType[IssueType.SECURITY_VULNERABILITY]).toBe(1);
    });

    it('should count multiple errors of the same type', () => {
      const errors: DetectedError[] = [
        {
          file: 'file1.ts',
          type: IssueType.TYPE_ERROR,
          severity: 'critical',
          description: 'Error 1'
        },
        {
          file: 'file2.ts',
          type: IssueType.TYPE_ERROR,
          severity: 'high',
          description: 'Error 2'
        },
        {
          file: 'file3.ts',
          type: IssueType.TYPE_ERROR,
          severity: 'medium',
          description: 'Error 3'
        }
      ];

      const summary = SummaryGenerator.generateSummary(errors);

      expect(summary.total).toBe(3);
      expect(summary.byType[IssueType.TYPE_ERROR]).toBe(3);
    });
  });
});

