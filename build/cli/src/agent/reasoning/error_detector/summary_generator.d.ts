/**
 * Summary Generator
 * Generates summaries of detected errors
 */
import { DetectedError, ErrorDetectionResult } from './types';
export declare class SummaryGenerator {
    /**
     * Generate summary of detected errors
     */
    static generateSummary(errors: DetectedError[]): ErrorDetectionResult['summary'];
}
