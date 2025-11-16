/**
 * Metrics Tracker
 * Tracks tokens, costs, latency, and other metrics
 */

import { Metrics } from '../types/agent_types';
import { logDebugInfo } from '../../utils/logger';

export interface CostConfig {
  inputCostPer1kTokens: number;
  outputCostPer1kTokens: number;
}

export class MetricsTracker {
  private metrics: Metrics;
  private startTime: number;
  private apiCallTimes: number[] = [];
  private costConfig?: CostConfig;

  constructor(costConfig?: CostConfig) {
    this.metrics = {
      totalTokens: { input: 0, output: 0 },
      apiCalls: 0,
      toolCalls: 0,
      averageLatency: 0,
      totalDuration: 0,
      errors: 0
    };
    this.startTime = Date.now();
    this.costConfig = costConfig;
  }

  /**
   * Record API call with tokens and latency
   */
  recordAPICall(inputTokens: number, outputTokens: number, latency: number): void {
    this.metrics.apiCalls++;
    this.metrics.totalTokens.input += inputTokens;
    this.metrics.totalTokens.output += outputTokens;
    this.apiCallTimes.push(latency);
    
    // Calculate average latency
    const sum = this.apiCallTimes.reduce((a, b) => a + b, 0);
    this.metrics.averageLatency = Math.round(sum / this.apiCallTimes.length);

    // Calculate cost if config provided
    if (this.costConfig) {
      const inputCost = (inputTokens / 1000) * this.costConfig.inputCostPer1kTokens;
      const outputCost = (outputTokens / 1000) * this.costConfig.outputCostPer1kTokens;
      this.metrics.totalCost = (this.metrics.totalCost || 0) + inputCost + outputCost;
    }

    logDebugInfo(`📊 API Call: ${inputTokens} in, ${outputTokens} out tokens, ${latency}ms latency`);
  }

  /**
   * Record tool call
   */
  recordToolCall(): void {
    this.metrics.toolCalls++;
  }

  /**
   * Record error
   */
  recordError(): void {
    this.metrics.errors++;
  }

  /**
   * Get current metrics
   */
  getMetrics(): Metrics {
    this.metrics.totalDuration = Date.now() - this.startTime;
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  reset(): void {
    this.metrics = {
      totalTokens: { input: 0, output: 0 },
      apiCalls: 0,
      toolCalls: 0,
      averageLatency: 0,
      totalDuration: 0,
      errors: 0
    };
    this.startTime = Date.now();
    this.apiCallTimes = [];
  }

  /**
   * Set cost configuration
   */
  setCostConfig(config: CostConfig): void {
    this.costConfig = config;
  }
}

