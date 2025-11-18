/**
 * Types for Intent Classifier Agent
 */
import { AgentResult } from '../../types';
export interface IntentClassifierOptions {
    model?: string;
    apiKey: string;
    maxTurns?: number;
}
export interface IntentClassificationResult {
    shouldApplyChanges: boolean;
    reasoning: string;
    confidence: 'high' | 'medium' | 'low';
    agentResult: AgentResult;
}
