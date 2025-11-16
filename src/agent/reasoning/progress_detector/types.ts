/**
 * Types and interfaces for Progress Detector
 */

import { AgentResult } from '../../types';

/**
 * Options for progress detection
 */
export interface ProgressDetectionOptions {
  model?: string;
  apiKey: string;
  personalAccessToken?: string; // GitHub Personal Access Token for loading repository files
  maxTurns?: number;
  repositoryOwner?: string;
  repositoryName?: string;
  repositoryBranch?: string; // Branch to analyze (required if repositoryOwner and repositoryName are provided)
  developmentBranch?: string; // Development branch to compare against (default: 'develop' or 'development')
  issueNumber?: number; // GitHub issue number
  issueDescription?: string; // Description of what needs to be done
  changedFiles?: Array<{
    filename: string;
    status: 'added' | 'modified' | 'removed' | 'renamed';
    additions?: number;
    deletions?: number;
    patch?: string;
  }>; // Files that have changed between branch and development branch
}

/**
 * Result of progress detection
 */
export interface ProgressDetectionResult {
  progress: number; // Progress percentage (0-100)
  summary: string; // Brief summary of progress assessment
  agentResult: AgentResult;
}

