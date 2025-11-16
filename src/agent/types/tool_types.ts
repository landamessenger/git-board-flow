/**
 * Tool types for the Agent SDK
 */

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
    additionalProperties?: boolean;
  };
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, any>;
}

export interface ToolResult {
  toolCallId: string;
  content: string | any;
  isError?: boolean;
  errorMessage?: string;
}

export interface ToolExecutionResult {
  success: boolean;
  result: any;
  error?: string;
}

