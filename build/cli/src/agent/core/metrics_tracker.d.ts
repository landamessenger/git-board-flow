/**
 * Metrics Tracker
 * Tracks tokens, costs, latency, and other metrics
 */
import { Metrics } from '../types/agent_types';
export interface CostConfig {
    inputCostPer1kTokens: number;
    outputCostPer1kTokens: number;
}
export declare class MetricsTracker {
    private metrics;
    private startTime;
    private apiCallTimes;
    private costConfig?;
    constructor(costConfig?: CostConfig);
    /**
     * Record API call with tokens and latency
     */
    recordAPICall(inputTokens: number, outputTokens: number, latency: number): void;
    /**
     * Record tool call
     */
    recordToolCall(): void;
    /**
     * Record error
     */
    recordError(): void;
    /**
     * Get current metrics
     */
    getMetrics(): Metrics;
    /**
     * Reset metrics
     */
    reset(): void;
    /**
     * Set cost configuration
     */
    setCostConfig(config: CostConfig): void;
}
