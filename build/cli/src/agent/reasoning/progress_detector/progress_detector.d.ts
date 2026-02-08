/**
 * Progress Detector
 * Uses Agent SDK to detect progress of a task based on code changes
 */
import { Agent } from '../../core/agent';
import { ProgressDetectionOptions, ProgressDetectionResult } from './types';
export declare class ProgressDetector {
    private agent;
    private options;
    private repositoryFiles;
    constructor(options: ProgressDetectionOptions);
    /**
     * Detect progress of the task
     */
    detectProgress(prompt?: string): Promise<ProgressDetectionResult>;
    /**
     * Get agent instance (for advanced usage)
     */
    getAgent(): Agent;
}
