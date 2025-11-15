/**
 * Reasoning Loop for Agent SDK
 * Manages the conversation loop with tool calling
 * Integrated with all advanced features: streaming, permissions, context, metrics, budget, timeouts, retry
 */
import { MessageManager } from './message_manager';
import { ToolExecutor } from '../tools/tool_executor';
import { AgentOptions, AgentResult } from '../types';
export declare class ReasoningLoop {
    private messageManager;
    private toolExecutor;
    private options;
    private aiRepository;
    private ai;
    private permissionsManager;
    private contextManager;
    private metricsTracker;
    private budgetManager;
    private retryManager;
    private sessionStartTime;
    private timeoutId?;
    constructor(messageManager: MessageManager, toolExecutor: ToolExecutor, options: AgentOptions);
    /**
     * Execute the reasoning loop
     */
    execute(): Promise<AgentResult>;
    /**
     * Call API with retry logic
     */
    private callAPIWithRetry;
    /**
     * Call OpenRouter API via AiRepository
     */
    private callAPI;
    /**
     * Execute tools with timeout
     */
    private executeToolsWithTimeout;
    /**
     * Create timeout promise
     */
    private createTimeoutPromise;
    /**
     * Estimate input tokens (rough approximation)
     */
    private estimateInputTokens;
    /**
     * Parse API response
     */
    private parseResponse;
    /**
     * Create result object
     */
    private createResult;
}
