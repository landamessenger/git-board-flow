/**
 * Budget Manager
 * Tracks and enforces budget limits
 */

import { BudgetConfig } from '../types/agent_types';
import { Metrics } from '../types/agent_types';
import { logDebugInfo, logWarn } from '../../utils/logger';

export class BudgetManager {
  private config: BudgetConfig;
  private currentCost: number = 0;
  private currentTokens: number = 0;

  constructor(config?: BudgetConfig) {
    this.config = {
      maxCost: config?.maxCost,
      maxTokens: config?.maxTokens,
      warnAtPercent: config?.warnAtPercent ?? 80
    };
  }

  /**
   * Check if budget is exceeded
   */
  isExceeded(metrics: Metrics): boolean {
    // Check token limit
    if (this.config.maxTokens) {
      const totalTokens = metrics.totalTokens.input + metrics.totalTokens.output;
      if (totalTokens > this.config.maxTokens) {
        return true;
      }
    }

    // Check cost limit
    if (this.config.maxCost && metrics.totalCost) {
      if (metrics.totalCost > this.config.maxCost) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if budget warning should be shown
   */
  shouldWarn(metrics: Metrics): boolean {
    if (!this.config.warnAtPercent) {
      return false;
    }

    // Check token warning
    if (this.config.maxTokens) {
      const totalTokens = metrics.totalTokens.input + metrics.totalTokens.output;
      const percent = (totalTokens / this.config.maxTokens) * 100;
      if (percent >= this.config.warnAtPercent) {
        return true;
      }
    }

    // Check cost warning
    if (this.config.maxCost && metrics.totalCost) {
      const percent = (metrics.totalCost / this.config.maxCost) * 100;
      if (percent >= this.config.warnAtPercent) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get budget status
   */
  getStatus(metrics: Metrics): {
    exceeded: boolean;
    warning: boolean;
    tokenUsage?: { used: number; limit: number; percent: number };
    costUsage?: { used: number; limit: number; percent: number };
  } {
    const status: any = {
      exceeded: this.isExceeded(metrics),
      warning: this.shouldWarn(metrics)
    };

    // Token usage
    if (this.config.maxTokens) {
      const totalTokens = metrics.totalTokens.input + metrics.totalTokens.output;
      status.tokenUsage = {
        used: totalTokens,
        limit: this.config.maxTokens,
        percent: Math.round((totalTokens / this.config.maxTokens) * 100)
      };
    }

    // Cost usage
    if (this.config.maxCost && metrics.totalCost) {
      status.costUsage = {
        used: metrics.totalCost,
        limit: this.config.maxCost,
        percent: Math.round((metrics.totalCost / this.config.maxCost) * 100)
      };
    }

    return status;
  }

  /**
   * Log budget status
   */
  logStatus(metrics: Metrics): void {
    const status = this.getStatus(metrics);

    if (status.exceeded) {
      logWarn('⚠️ Budget exceeded!');
    } else if (status.warning) {
      logWarn('⚠️ Budget warning: Approaching limit');
    }

    if (status.tokenUsage) {
      logDebugInfo(`💰 Tokens: ${status.tokenUsage.used}/${status.tokenUsage.limit} (${status.tokenUsage.percent}%)`);
    }

    if (status.costUsage) {
      logDebugInfo(`💰 Cost: $${status.costUsage.used.toFixed(4)}/$${status.costUsage.limit.toFixed(4)} (${status.costUsage.percent}%)`);
    }
  }

  /**
   * Update budget config
   */
  updateConfig(config: BudgetConfig): void {
    this.config = { ...this.config, ...config };
  }
}

