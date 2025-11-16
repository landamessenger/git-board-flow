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
  repositoryBranch?: string; // Branch to analyze (default: will be detected)
  focusAreas?: string[]; // Specific areas to focus on (e.g., ['src/agent', 'src/utils'])
  errorTypes?: string[]; // Types of errors to look for (e.g., ['type-errors', 'logic-errors', 'security-issues'])
  useSubAgents?: boolean; // Use subagents to parallelize file reading (default: false)
  maxConcurrentSubAgents?: number; // Maximum number of subagents to run in parallel (default: 5)
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

