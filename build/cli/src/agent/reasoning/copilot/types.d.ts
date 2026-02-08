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
    personalAccessToken?: string;
    maxTurns?: number;
    repositoryOwner?: string;
    repositoryName?: string;
    repositoryBranch?: string;
    workingDirectory?: string;
    useSubAgents?: boolean;
    maxConcurrentSubAgents?: number;
    userPrompt?: string;
    useIntentClassifier?: boolean;
    shouldApplyChanges?: boolean;
}
/**
 * Change plan proposed by a subagent (Phase 1: Analysis)
 */
export interface ChangePlan {
    file: string;
    changeType: ChangeType;
    description: string;
    suggestedCode: string;
    reasoning: string;
    proposedBy: string;
}
/**
 * Result of Copilot agent execution
 */
export interface CopilotResult {
    response: string;
    agentResult: AgentResult;
    changes?: Array<{
        file: string;
        changeType: ChangeType;
        description?: string;
    }>;
}
