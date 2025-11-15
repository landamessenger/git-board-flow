/**
 * Agent types for the Agent SDK
 */

import { Message } from './message_types';
import { ToolCall, ToolResult } from './tool_types';

export interface AgentOptions {
  model: string;
  apiKey: string;
  systemPrompt?: string;
  maxTurns?: number;
  maxTokens?: number;
  temperature?: number;
  tools?: any[]; // BaseTool[]
  onTurnComplete?: (turn: TurnResult) => void;
  onError?: (error: Error) => void;
  onToolCall?: (toolCall: ToolCall) => void;
  onToolResult?: (result: ToolResult) => void;
}

export interface TurnResult {
  turnNumber: number;
  assistantMessage: string;
  toolCalls: ToolCall[];
  toolResults?: ToolResult[];
  reasoning?: string;
  timestamp: number;
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
  error?: Error;
  truncated?: boolean;
}

export interface ParsedResponse {
  text: string;
  toolCalls?: ToolCall[];
  reasoning?: string;
}

