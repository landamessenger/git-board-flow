/**
 * Tests for MetricsTracker
 */

import { MetricsTracker } from '../core/metrics_tracker';

describe('MetricsTracker', () => {
  let tracker: MetricsTracker;

  beforeEach(() => {
    tracker = new MetricsTracker();
  });

  describe('recordAPICall', () => {
    it('should record API call metrics', () => {
      tracker.recordAPICall(100, 50, 200);
      
      const metrics = tracker.getMetrics();
      expect(metrics.apiCalls).toBe(1);
      expect(metrics.totalTokens.input).toBe(100);
      expect(metrics.totalTokens.output).toBe(50);
      expect(metrics.averageLatency).toBe(200);
    });

    it('should calculate average latency across multiple calls', () => {
      tracker.recordAPICall(100, 50, 100);
      tracker.recordAPICall(200, 100, 300);
      
      const metrics = tracker.getMetrics();
      expect(metrics.averageLatency).toBe(200); // (100 + 300) / 2
    });

    it('should calculate cost when config provided', () => {
      const costTracker = new MetricsTracker({
        inputCostPer1kTokens: 0.01,
        outputCostPer1kTokens: 0.02
      });
      
      costTracker.recordAPICall(1000, 500, 100);
      
      const metrics = costTracker.getMetrics();
      expect(metrics.totalCost).toBeCloseTo(0.02); // (1 * 0.01) + (0.5 * 0.02)
    });
  });

  describe('recordToolCall', () => {
    it('should increment tool call count', () => {
      tracker.recordToolCall();
      tracker.recordToolCall();
      
      const metrics = tracker.getMetrics();
      expect(metrics.toolCalls).toBe(2);
    });
  });

  describe('recordError', () => {
    it('should increment error count', () => {
      tracker.recordError();
      tracker.recordError();
      
      const metrics = tracker.getMetrics();
      expect(metrics.errors).toBe(2);
    });
  });

  describe('reset', () => {
    it('should reset all metrics', () => {
      tracker.recordAPICall(100, 50, 200);
      tracker.recordToolCall();
      tracker.recordError();
      
      tracker.reset();
      
      const metrics = tracker.getMetrics();
      expect(metrics.apiCalls).toBe(0);
      expect(metrics.toolCalls).toBe(0);
      expect(metrics.errors).toBe(0);
      expect(metrics.totalTokens.input).toBe(0);
      expect(metrics.totalTokens.output).toBe(0);
    });
  });

  describe('getMetrics', () => {
    it('should calculate total duration', () => {
      // Wait a bit to ensure duration > 0
      return new Promise(resolve => {
        setTimeout(() => {
          const metrics = tracker.getMetrics();
          expect(metrics.totalDuration).toBeGreaterThan(0);
          resolve(undefined);
        }, 10);
      });
    });
  });
});

