/**
 * Retry Manager
 * Handles retries with exponential backoff and circuit breaker
 */

import { RetryConfig } from '../types/agent_types';
import { logDebugInfo, logError } from '../../utils/logger';

export class RetryManager {
  private config: Required<RetryConfig>;
  private circuitBreakerState: 'closed' | 'open' | 'half-open' = 'closed';
  private circuitBreakerFailures: number = 0;
  private circuitBreakerLastFailure: number = 0;
  private readonly circuitBreakerThreshold: number = 5;
  private readonly circuitBreakerTimeout: number = 60000; // 1 minute

  constructor(config?: RetryConfig) {
    this.config = {
      maxRetries: config?.maxRetries ?? 3,
      initialDelay: config?.initialDelay ?? 1000,
      maxDelay: config?.maxDelay ?? 30000,
      backoffMultiplier: config?.backoffMultiplier ?? 2,
      retryableErrors: config?.retryableErrors ?? [429, 500, 502, 503, 504]
    };
  }

  /**
   * Execute function with retry logic
   */
  async execute<T>(
    fn: () => Promise<T>,
    errorHandler?: (error: any, attempt: number) => boolean
  ): Promise<T> {
    // Check circuit breaker
    if (this.circuitBreakerState === 'open') {
      const timeSinceLastFailure = Date.now() - this.circuitBreakerLastFailure;
      if (timeSinceLastFailure > this.circuitBreakerTimeout) {
        this.circuitBreakerState = 'half-open';
        logDebugInfo('🔌 Circuit breaker: half-open (testing)');
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    let lastError: any;
    let delay = this.config.initialDelay;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const result = await fn();
        
        // Success - reset circuit breaker
        if (this.circuitBreakerState === 'half-open') {
          this.circuitBreakerState = 'closed';
          this.circuitBreakerFailures = 0;
          logDebugInfo('🔌 Circuit breaker: closed (reset)');
        }
        
        return result;
      } catch (error: any) {
        lastError = error;

        // Check if error is retryable
        const isRetryable = this.isRetryableError(error);
        
        // Custom error handler can override retry decision
        if (errorHandler) {
          const shouldRetry = errorHandler(error, attempt);
          if (!shouldRetry) {
            break;
          }
        } else if (!isRetryable) {
          break;
        }

        // Don't retry on last attempt
        if (attempt >= this.config.maxRetries) {
          break;
        }

        // Record failure for circuit breaker
        this.circuitBreakerFailures++;
        this.circuitBreakerLastFailure = Date.now();

        if (this.circuitBreakerFailures >= this.circuitBreakerThreshold) {
          this.circuitBreakerState = 'open';
          logError('🔌 Circuit breaker: open (too many failures)');
          throw new Error('Circuit breaker is open due to too many failures');
        }

        logDebugInfo(`🔄 Retry attempt ${attempt + 1}/${this.config.maxRetries} after ${delay}ms`);

        // Wait before retry
        await this.sleep(delay);

        // Exponential backoff
        delay = Math.min(delay * this.config.backoffMultiplier, this.config.maxDelay);
      }
    }

    throw lastError;
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    // Check HTTP status code
    if (error.status && this.config.retryableErrors.includes(error.status)) {
      return true;
    }

    // Check error message for network errors
    const message = error.message?.toLowerCase() || '';
    if (message.includes('network') || message.includes('timeout') || message.includes('econnreset')) {
      return true;
    }

    return false;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Reset circuit breaker
   */
  resetCircuitBreaker(): void {
    this.circuitBreakerState = 'closed';
    this.circuitBreakerFailures = 0;
    this.circuitBreakerLastFailure = 0;
  }
}

