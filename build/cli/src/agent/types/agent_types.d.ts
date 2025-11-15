/**
 * Agent types for the Agent SDK
 */
import { Message } from './message_types';
import { ToolCall, ToolResult } from './tool_types';
export type ToolPermissionStrategy = 'allowlist' | 'blocklist' | 'all';
export type StreamChunk = {
    type: 'text' | 'tool_call' | 'reasoning' | 'done';
    content: string;
    toolCall?: ToolCall;
};
export interface ToolPermissions {
    strategy: ToolPermissionStrategy;
    allowed?: string[];
    blocked?: string[];
}
export interface BudgetConfig {
    maxCost?: number;
    maxTokens?: number;
    warnAtPercent?: number;
}
export interface TimeoutConfig {
    apiCall?: number;
    toolExecution?: number;
    totalSession?: number;
}
export interface RetryConfig {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffMultiplier?: number;
    retryableErrors?: number[];
}
export interface AgentOptions {
    model: string;
    apiKey: string;
    systemPrompt?: string;
    maxTurns?: number;
    maxTokens?: number;
    temperature?: number;
    tools?: any[];
    onTurnComplete?: (turn: TurnResult) => void;
    onError?: (error: Error) => void;
    onToolCall?: (toolCall: ToolCall) => void;
    onToolResult?: (result: ToolResult) => void;
    streaming?: boolean;
    onStreamChunk?: (chunk: StreamChunk) => void;
    toolPermissions?: ToolPermissions;
    maxContextLength?: number;
    contextCompressionEnabled?: boolean;
    sessionId?: string;
    persistSession?: boolean;
    trackMetrics?: boolean;
    onMetrics?: (metrics: Metrics) => void;
    budget?: BudgetConfig;
    timeouts?: TimeoutConfig;
    retry?: RetryConfig;
}
export interface TurnResult {
    turnNumber: number;
    assistantMessage: string;
    toolCalls: ToolCall[];
    toolResults?: ToolResult[];
    reasoning?: string;
    timestamp: number;
}
export interface Metrics {
    totalTokens: {
        input: number;
        output: number;
    };
    totalCost?: number;
    apiCalls: number;
    toolCalls: number;
    averageLatency: number;
    totalDuration: number;
    errors: number;
}
export interface AgentResult {
    finalResponse: string;
    turns: TurnResult[];
    toolCalls: ToolCall[];
    messages: Message[];
    totalTokens?: {
        input: number;
        output: number;
    };
    metrics?: Metrics;
    error?: Error;
    truncated?: boolean;
    budgetExceeded?: boolean;
    timeoutExceeded?: boolean;
}
export interface ParsedResponse {
    text: string;
    toolCalls?: ToolCall[];
    reasoning?: string;
}
