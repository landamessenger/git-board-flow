/**
 * Types and interfaces for Copilot Agent
 */

import { AgentResult } from '../../types';
import { ChangeType } from '../../../data/model/think_response';

/**
 * Options for Copilot agent
 */
export interface CopilotOptions {
  model?: string;
  apiKey: string;
  personalAccessToken?: string; // GitHub Personal Access Token for loading repository files
  maxTurns?: number;
  repositoryOwner?: string;
  repositoryName?: string;
  repositoryBranch?: string; // Branch to analyze (required if repositoryOwner and repositoryName are provided)
  workingDirectory?: string; // Working directory for file operations (default: current directory)
  useSubAgents?: boolean; // Use subagents to parallelize file reading (default: false)
  maxConcurrentSubAgents?: number; // Maximum number of subagents to run in parallel (default: 5)
  userPrompt?: string; // Original user prompt for context (used for auto-detecting auto_apply)
  useIntentClassifier?: boolean; // Use intent classifier to determine if changes should be applied (default: true)
  shouldApplyChanges?: boolean; // Pre-classified intent: should changes be applied? (from intent classifier)
}

/**
 * Result of Copilot agent execution
 */
export interface CopilotResult {
  response: string; // The agent's response to the user's prompt
  agentResult: AgentResult;
  changes?: Array<{
    file: string;
    changeType: ChangeType;
    description?: string;
  }>; // List of changes made (if any)
}

