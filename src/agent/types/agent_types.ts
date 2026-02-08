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
  warnAtPercent?: number; // Warn when reaching this percentage (0-100)
}

export interface TimeoutConfig {
  apiCall?: number; // milliseconds
  toolExecution?: number; // milliseconds
  totalSession?: number; // milliseconds
}

export interface RetryConfig {
  maxRetries?: number;
  initialDelay?: number; // milliseconds
  maxDelay?: number; // milliseconds
  backoffMultiplier?: number;
  retryableErrors?: number[]; // HTTP status codes to retry
}

export interface AgentOptions {
  model: string;
  /** OpenCode server URL (e.g. http://localhost:4096) */
  serverUrl: string;
  systemPrompt?: string;
  maxTurns?: number;
  maxTokens?: number;
  temperature?: number;
  tools?: any[]; // BaseTool[]
  
  // Callbacks
  onTurnComplete?: (turn: TurnResult) => void;
  onError?: (error: Error) => void;
  onToolCall?: (toolCall: ToolCall) => void;
  onToolResult?: (result: ToolResult) => void;
  
  // Streaming
  streaming?: boolean;
  onStreamChunk?: (chunk: StreamChunk) => void;
  
  // Permissions
  toolPermissions?: ToolPermissions;
  
  // Context management
  maxContextLength?: number; // Max tokens in context
  contextCompressionEnabled?: boolean;
  
  // Sessions
  sessionId?: string;
  persistSession?: boolean;
  
  // Metrics
  trackMetrics?: boolean;
  onMetrics?: (metrics: Metrics) => void;
  
  // Budget
  budget?: BudgetConfig;
  
  // Timeouts
  timeouts?: TimeoutConfig;
  
  // Retry
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
  averageLatency: number; // milliseconds
  totalDuration: number; // milliseconds
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

