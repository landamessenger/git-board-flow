/**
 * Budget Manager
 * Tracks and enforces budget limits
 */
import { BudgetConfig } from '../types/agent_types';
import { Metrics } from '../types/agent_types';
export declare class BudgetManager {
    private config;
    private currentCost;
    private currentTokens;
    constructor(config?: BudgetConfig);
    /**
     * Check if budget is exceeded
     */
    isExceeded(metrics: Metrics): boolean;
    /**
     * Check if budget warning should be shown
     */
    shouldWarn(metrics: Metrics): boolean;
    /**
     * Get budget status
     */
    getStatus(metrics: Metrics): {
        exceeded: boolean;
        warning: boolean;
        tokenUsage?: {
            used: number;
            limit: number;
            percent: number;
        };
        costUsage?: {
            used: number;
            limit: number;
            percent: number;
        };
    };
    /**
     * Log budget status
     */
    logStatus(metrics: Metrics): void;
    /**
     * Update budget config
     */
    updateConfig(config: BudgetConfig): void;
}
