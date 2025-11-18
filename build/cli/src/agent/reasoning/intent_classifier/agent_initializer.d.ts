/**
 * Agent Initializer
 * Initializes agent with tools for Intent Classifier
 */
import { Agent } from '../../core/agent';
import { IntentClassifierOptions, ConfidenceLevel } from './types';
export interface AgentInitializerResult {
    agent: Agent;
    reportedIntent?: {
        shouldApplyChanges: boolean;
        reasoning: string;
        confidence: ConfidenceLevel;
    };
}
export declare class AgentInitializer {
    /**
     * Initialize agent with tools
     */
    static initialize(options: IntentClassifierOptions): Promise<AgentInitializerResult>;
    /**
     * Create tools for the agent
     */
    private static createTools;
}
