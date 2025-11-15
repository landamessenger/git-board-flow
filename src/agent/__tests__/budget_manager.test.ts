/**
 * Tests for BudgetManager
 */

import { BudgetManager } from '../core/budget_manager';
import { Metrics } from '../types/agent_types';

describe('BudgetManager', () => {
  describe('isExceeded', () => {
    it('should detect token limit exceeded', () => {
      const manager = new BudgetManager({ maxTokens: 1000 });
      const metrics: Metrics = {
        totalTokens: { input: 600, output: 500 },
        apiCalls: 1,
        toolCalls: 0,
        averageLatency: 100,
        totalDuration: 1000,
        errors: 0
      };
      
      expect(manager.isExceeded(metrics)).toBe(true);
    });

    it('should detect cost limit exceeded', () => {
      const manager = new BudgetManager({ maxCost: 0.01 });
      const metrics: Metrics = {
        totalTokens: { input: 100, output: 50 },
        totalCost: 0.02,
        apiCalls: 1,
        toolCalls: 0,
        averageLatency: 100,
        totalDuration: 1000,
        errors: 0
      };
      
      expect(manager.isExceeded(metrics)).toBe(true);
    });

    it('should return false when within limits', () => {
      const manager = new BudgetManager({ maxTokens: 1000, maxCost: 0.01 });
      const metrics: Metrics = {
        totalTokens: { input: 100, output: 50 },
        totalCost: 0.005,
        apiCalls: 1,
        toolCalls: 0,
        averageLatency: 100,
        totalDuration: 1000,
        errors: 0
      };
      
      expect(manager.isExceeded(metrics)).toBe(false);
    });
  });

  describe('shouldWarn', () => {
    it('should warn at configured percentage', () => {
      const manager = new BudgetManager({ 
        maxTokens: 1000,
        warnAtPercent: 80
      });
      const metrics: Metrics = {
        totalTokens: { input: 400, output: 400 }, // 80% of 1000
        apiCalls: 1,
        toolCalls: 0,
        averageLatency: 100,
        totalDuration: 1000,
        errors: 0
      };
      
      expect(manager.shouldWarn(metrics)).toBe(true);
    });

    it('should not warn below threshold', () => {
      const manager = new BudgetManager({ 
        maxTokens: 1000,
        warnAtPercent: 80
      });
      const metrics: Metrics = {
        totalTokens: { input: 300, output: 300 }, // 60% of 1000
        apiCalls: 1,
        toolCalls: 0,
        averageLatency: 100,
        totalDuration: 1000,
        errors: 0
      };
      
      expect(manager.shouldWarn(metrics)).toBe(false);
    });
  });

  describe('getStatus', () => {
    it('should return status with usage information', () => {
      const manager = new BudgetManager({ maxTokens: 1000 });
      const metrics: Metrics = {
        totalTokens: { input: 500, output: 300 },
        apiCalls: 1,
        toolCalls: 0,
        averageLatency: 100,
        totalDuration: 1000,
        errors: 0
      };
      
      const status = manager.getStatus(metrics);
      
      expect(status.exceeded).toBe(false);
      expect(status.tokenUsage).toBeDefined();
      expect(status.tokenUsage?.used).toBe(800);
      expect(status.tokenUsage?.limit).toBe(1000);
      expect(status.tokenUsage?.percent).toBe(80);
    });
  });
});

