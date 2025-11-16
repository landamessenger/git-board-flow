/**
 * Summary Generator
 * Generates summaries of detected errors
 */

import { DetectedError, ErrorDetectionResult } from './types';

export class SummaryGenerator {
  /**
   * Generate summary of detected errors
   */
  static generateSummary(errors: DetectedError[]): ErrorDetectionResult['summary'] {
    const bySeverity = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    };

    const byType: Record<string, number> = {};

    for (const error of errors) {
      bySeverity[error.severity]++;
      byType[error.type] = (byType[error.type] || 0) + 1;
    }

    return {
      total: errors.length,
      bySeverity,
      byType
    };
  }
}

