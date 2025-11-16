/**
 * Error Detector
 * Uses Agent SDK to detect potential errors in the codebase
 */
import { Agent } from '../../core/agent';
import { ErrorDetectionOptions, ErrorDetectionResult } from './types';
export declare class ErrorDetector {
    private agent;
    private options;
    private repositoryFiles;
    constructor(options: ErrorDetectionOptions);
    /**
     * Detect errors in the codebase
     */
    detectErrors(prompt?: string): Promise<ErrorDetectionResult>;
    /**
     * Get agent instance (for advanced usage)
     */
    getAgent(): Agent;
}
