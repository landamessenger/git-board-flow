/**
 * Types for Intent Classifier Agent
 */
import { AgentResult } from '../../types';
export declare enum ConfidenceLevel {
    HIGH = "high",
    MEDIUM = "medium",
    LOW = "low"
}
export interface IntentClassifierOptions {
    model?: string;
    serverUrl: string;
    maxTurns?: number;
}
export interface IntentClassificationResult {
    shouldApplyChanges: boolean;
    reasoning: string;
    confidence: ConfidenceLevel;
    agentResult: AgentResult;
}
