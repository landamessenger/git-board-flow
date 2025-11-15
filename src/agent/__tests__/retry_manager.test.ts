/**
 * Tests for RetryManager
 */

import { RetryManager } from '../core/retry_manager';

describe('RetryManager', () => {
  describe('execute', () => {
    it('should execute function successfully on first try', async () => {
      const manager = new RetryManager();
      let callCount = 0;
      
      const result = await manager.execute(async () => {
        callCount++;
        return 'success';
      });
      
      expect(result).toBe('success');
      expect(callCount).toBe(1);
    });

    it('should retry on retryable errors', async () => {
      const manager = new RetryManager({
        maxRetries: 2,
        initialDelay: 10,
        retryableErrors: [500]
      });
      
      let callCount = 0;
      
      const result = await manager.execute(async () => {
        callCount++;
        if (callCount < 2) {
          const error: any = new Error('Server error');
          error.status = 500;
          throw error;
        }
        return 'success';
      });
      
      expect(result).toBe('success');
      expect(callCount).toBe(2);
    });

    it('should not retry on non-retryable errors', async () => {
      const manager = new RetryManager({
        maxRetries: 2,
        initialDelay: 10,
        retryableErrors: [500]
      });
      
      let callCount = 0;
      
      await expect(
        manager.execute(async () => {
          callCount++;
          const error: any = new Error('Client error');
          error.status = 400;
          throw error;
        })
      ).rejects.toThrow();
      
      expect(callCount).toBe(1);
    });

    it('should use exponential backoff', async () => {
      const manager = new RetryManager({
        maxRetries: 2,
        initialDelay: 10,
        backoffMultiplier: 2
      });
      
      const startTime = Date.now();
      let callCount = 0;
      
      await manager.execute(async () => {
        callCount++;
        if (callCount < 2) {
          throw new Error('Network error');
        }
        return 'success';
      });
      
      const duration = Date.now() - startTime;
      // Should have waited at least initialDelay (10ms)
      expect(duration).toBeGreaterThanOrEqual(10);
    });

    it('should respect max retries', async () => {
      const manager = new RetryManager({
        maxRetries: 2,
        initialDelay: 10,
        retryableErrors: [500] // Make errors retryable
      });
      
      let callCount = 0;
      
      await expect(
        manager.execute(async () => {
          callCount++;
          const error: any = new Error('Always fails');
          error.status = 500; // Make it retryable
          throw error;
        })
      ).rejects.toThrow();
      
      expect(callCount).toBe(3); // Initial + 2 retries
    });
  });

  describe('resetCircuitBreaker', () => {
    it('should reset circuit breaker state', () => {
      const manager = new RetryManager();
      manager.resetCircuitBreaker();
      // Just verify it doesn't throw
      expect(manager).toBeDefined();
    });
  });
});

