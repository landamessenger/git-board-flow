/**
 * Error handler for Agent SDK
 */
export declare class AgentError extends Error {
    code: string;
    context?: any | undefined;
    constructor(message: string, code: string, context?: any | undefined);
}
export declare class ToolExecutionError extends AgentError {
    toolName: string;
    toolInput?: any | undefined;
    constructor(message: string, toolName: string, toolInput?: any | undefined);
}
export declare class APIError extends AgentError {
    statusCode?: number | undefined;
    response?: any | undefined;
    constructor(message: string, statusCode?: number | undefined, response?: any | undefined);
}
export declare class ValidationError extends AgentError {
    field?: string | undefined;
    constructor(message: string, field?: string | undefined);
}
export declare class ErrorHandler {
    /**
     * Handle and format errors
     */
    static handle(error: unknown): Error;
    /**
     * Check if error is retryable
     */
    static isRetryable(error: Error): boolean;
}
