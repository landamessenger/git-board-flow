/**
 * Types and interfaces for Copilot Agent
 */
import { AgentResult } from '../../types';
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
}
/**
 * Result of Copilot agent execution
 */
export interface CopilotResult {
    response: string;
    agentResult: AgentResult;
    changes?: Array<{
        file: string;
        changeType: 'create' | 'modify' | 'delete' | 'refactor';
        description?: string;
    }>;
}
