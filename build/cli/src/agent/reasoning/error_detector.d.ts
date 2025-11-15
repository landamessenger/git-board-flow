/**
 * Error Detector
 * Uses Agent SDK to detect potential errors in the codebase
 */
import { Agent } from '../core/agent';
import { AgentResult } from '../types';
export interface ErrorDetectionOptions {
    model?: string;
    apiKey: string;
    maxTurns?: number;
    repositoryOwner?: string;
    repositoryName?: string;
    repositoryBranch?: string;
    focusAreas?: string[];
    errorTypes?: string[];
}
export interface DetectedError {
    file: string;
    line?: number;
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    suggestion?: string;
}
export interface ErrorDetectionResult {
    errors: DetectedError[];
    summary: {
        total: number;
        bySeverity: {
            critical: number;
            high: number;
            medium: number;
            low: number;
        };
        byType: Record<string, number>;
    };
    agentResult: AgentResult;
}
export declare class ErrorDetector {
    private agent;
    private fileRepository;
    private options;
    constructor(options: ErrorDetectionOptions);
    private initializeAgent;
    private buildSystemPrompt;
    /**
     * Detect errors in the codebase
     */
    detectErrors(prompt?: string): Promise<ErrorDetectionResult>;
    /**
     * Parse errors from agent result
     */
    private parseErrors;
    /**
     * Extract errors from text response
     */
    private extractErrorsFromText;
    /**
     * Extract errors from change description
     */
    private extractErrorsFromChangeDescription;
    /**
     * Generate summary of detected errors
     */
    private generateSummary;
    /**
     * Get agent instance (for advanced usage)
     */
    getAgent(): Agent;
}
