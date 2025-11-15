/**
 * Error handler for Agent SDK
 */

export class AgentError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: any
  ) {
    super(message);
    this.name = 'AgentError';
  }
}

export class ToolExecutionError extends AgentError {
  constructor(
    message: string,
    public toolName: string,
    public toolInput?: any
  ) {
    super(message, 'TOOL_EXECUTION_ERROR', { toolName, toolInput });
    this.name = 'ToolExecutionError';
  }
}

export class APIError extends AgentError {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: any
  ) {
    super(message, 'API_ERROR', { statusCode, response });
    this.name = 'APIError';
  }
}

export class ValidationError extends AgentError {
  constructor(
    message: string,
    public field?: string
  ) {
    super(message, 'VALIDATION_ERROR', { field });
    this.name = 'ValidationError';
  }
}

export class ErrorHandler {
  /**
   * Handle and format errors
   */
  static handle(error: unknown): Error {
    if (error instanceof AgentError) {
      return error;
    }

    if (error instanceof Error) {
      return new AgentError(error.message, 'UNKNOWN_ERROR', { originalError: error });
    }

    return new AgentError(String(error), 'UNKNOWN_ERROR');
  }

  /**
   * Check if error is retryable
   */
  static isRetryable(error: Error): boolean {
    if (error instanceof APIError) {
      // Retry on 5xx errors or rate limits
      return error.statusCode === undefined 
        || (error.statusCode >= 500 && error.statusCode < 600)
        || error.statusCode === 429;
    }

    return false;
  }
}

