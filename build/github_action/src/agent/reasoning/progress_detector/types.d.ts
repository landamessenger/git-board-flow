/**
 * Types and interfaces for Progress Detector
 */
import { AgentResult } from '../../types';
/**
 * Options for progress detection
 */
export interface ProgressDetectionOptions {
    model?: string;
    serverUrl: string;
    personalAccessToken?: string;
    maxTurns?: number;
    repositoryOwner?: string;
    repositoryName?: string;
    repositoryBranch?: string;
    developmentBranch?: string;
    issueNumber?: number;
    issueDescription?: string;
    changedFiles?: Array<{
        filename: string;
        status: 'added' | 'modified' | 'removed' | 'renamed';
        additions?: number;
        deletions?: number;
        patch?: string;
    }>;
    useSubAgents?: boolean;
    maxConcurrentSubAgents?: number;
}
/**
 * Result of progress detection
 */
export interface ProgressDetectionResult {
    progress: number;
    summary: string;
    agentResult: AgentResult;
}
