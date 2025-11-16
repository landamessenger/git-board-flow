/**
 * Types and interfaces for Error Detector
 */
import { AgentResult } from '../../types';
export interface ErrorDetectionOptions {
    model?: string;
    apiKey: string;
    maxTurns?: number;
    repositoryOwner?: string;
    repositoryName?: string;
    repositoryBranch?: string;
    focusAreas?: string[];
    errorTypes?: string[];
    useSubAgents?: boolean;
    maxConcurrentSubAgents?: number;
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
