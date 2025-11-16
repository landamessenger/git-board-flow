/**
 * Retry Manager
 * Handles retries with exponential backoff and circuit breaker
 */
import { RetryConfig } from '../types/agent_types';
export declare class RetryManager {
    private config;
    private circuitBreakerState;
    private circuitBreakerFailures;
    private circuitBreakerLastFailure;
    private readonly circuitBreakerThreshold;
    private readonly circuitBreakerTimeout;
    constructor(config?: RetryConfig);
    /**
     * Execute function with retry logic
     */
    execute<T>(fn: () => Promise<T>, errorHandler?: (error: any, attempt: number) => boolean): Promise<T>;
    /**
     * Check if error is retryable
     */
    private isRetryableError;
    /**
     * Sleep utility
     */
    private sleep;
    /**
     * Reset circuit breaker
     */
    resetCircuitBreaker(): void;
}
