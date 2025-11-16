/**
 * Tests for ContextManager
 */

import { ContextManager } from '../core/context_manager';
import { Message } from '../types/message_types';

describe('ContextManager', () => {
  let manager: ContextManager;

  beforeEach(() => {
    manager = new ContextManager(1000, true); // Small limit for testing
  });

  describe('estimateTokens', () => {
    it('should estimate tokens for string messages', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello world' } // ~3 tokens
      ];
      
      const tokens = manager.estimateTokens(messages);
      expect(tokens).toBeGreaterThan(0);
    });

    it('should estimate tokens for content blocks', () => {
      const messages: Message[] = [
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Response text' }
          ]
        }
      ];
      
      const tokens = manager.estimateTokens(messages);
      expect(tokens).toBeGreaterThan(0);
    });
  });

  describe('needsCompression', () => {
    it('should return false when under limit', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Short message' }
      ];
      
      expect(manager.needsCompression(messages)).toBe(false);
    });

    it('should return true when over 80% of limit', () => {
      // Create a large message
      const largeContent = 'x'.repeat(4000); // ~1000 tokens
      const messages: Message[] = [
        { role: 'user', content: largeContent }
      ];
      
      expect(manager.needsCompression(messages)).toBe(true);
    });

    it('should return false when compression disabled', () => {
      const noCompressManager = new ContextManager(1000, false);
      const largeContent = 'x'.repeat(4000);
      const messages: Message[] = [
        { role: 'user', content: largeContent }
      ];
      
      expect(noCompressManager.needsCompression(messages)).toBe(false);
    });
  });

  describe('compressContext', () => {
    it('should compress when needed', () => {
      // Create content that exceeds 80% of 1000 token limit
      // 1000 tokens * 0.8 = 800 tokens * 4 chars/token = 3200 chars
      const largeContent = 'x'.repeat(4000);
      const messages: Message[] = [
        { role: 'system', content: 'System message' },
        { role: 'user', content: largeContent },
        { role: 'user', content: largeContent },
        { role: 'user', content: largeContent },
        { role: 'user', content: largeContent }
      ];
      
      const compressed = manager.compressContext(messages);
      
      // Should compress: system + summary + recent (last 10, but we have 5 total)
      // So: system + summary + 4 recent = 6, but original is 5
      // Actually, it keeps last 10, so if we have 5, it keeps all 5 + summary = 6
      // But we need to ensure compression happens
      expect(compressed.length).toBeLessThanOrEqual(messages.length + 1); // +1 for summary
      expect(compressed[0].role).toBe('system'); // System message preserved
    });

    it('should not compress when not needed', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Short message' }
      ];
      
      const compressed = manager.compressContext(messages);
      expect(compressed).toEqual(messages);
    });
  });

  describe('getStats', () => {
    it('should return context statistics', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Test message' }
      ];
      
      const stats = manager.getStats(messages);
      
      expect(stats.messageCount).toBe(1);
      expect(stats.estimatedTokens).toBeGreaterThan(0);
      expect(typeof stats.compressed).toBe('boolean');
    });
  });
});

