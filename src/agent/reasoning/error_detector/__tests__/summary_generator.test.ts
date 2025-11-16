/**
 * Tests for Summary Generator
 */

import { SummaryGenerator } from '../summary_generator';
import { DetectedError } from '../types';

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
          type: 'type-error',
          severity: 'critical',
          description: 'Critical error'
        },
        {
          file: 'file2.ts',
          type: 'logic-error',
          severity: 'high',
          description: 'High error'
        },
        {
          file: 'file3.ts',
          type: 'type-error',
          severity: 'medium',
          description: 'Medium error'
        },
        {
          file: 'file4.ts',
          type: 'security-issue',
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
      expect(summary.byType['type-error']).toBe(2);
      expect(summary.byType['logic-error']).toBe(1);
      expect(summary.byType['security-issue']).toBe(1);
    });

    it('should count multiple errors of the same type', () => {
      const errors: DetectedError[] = [
        {
          file: 'file1.ts',
          type: 'type-error',
          severity: 'critical',
          description: 'Error 1'
        },
        {
          file: 'file2.ts',
          type: 'type-error',
          severity: 'high',
          description: 'Error 2'
        },
        {
          file: 'file3.ts',
          type: 'type-error',
          severity: 'medium',
          description: 'Error 3'
        }
      ];

      const summary = SummaryGenerator.generateSummary(errors);

      expect(summary.total).toBe(3);
      expect(summary.byType['type-error']).toBe(3);
    });
  });
});

