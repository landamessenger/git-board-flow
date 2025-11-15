/**
 * Tests for Context Sharing
 */

import { ContextSharing } from '../core/context_sharing';
import { Message } from '../types';
import { MessageManager } from '../core/message_manager';

describe('ContextSharing', () => {
  describe('extractRelevantMessages', () => {
    it('should extract system and recent messages', () => {
      const messages: Message[] = [
        { role: 'system', content: 'System prompt' },
        { role: 'user', content: 'Message 1' },
        { role: 'user', content: 'Message 2' },
        { role: 'assistant', content: 'Response 1' },
        { role: 'user', content: 'Message 3' }
      ];

      const relevant = ContextSharing.extractRelevantMessages(messages, 3);

      expect(relevant).toHaveLength(4); // 1 system + 3 recent
      expect(relevant[0].role).toBe('system');
      expect(relevant[relevant.length - 1].content).toBe('Message 3');
    });

    it('should limit messages to maxMessages', () => {
      const messages: Message[] = Array.from({ length: 20 }, (_, i) => ({
        role: 'user',
        content: `Message ${i}`
      }));

      const relevant = ContextSharing.extractRelevantMessages(messages, 5);

      expect(relevant.length).toBeLessThanOrEqual(5);
    });
  });

  describe('shareContext', () => {
    it('should share context between message managers', () => {
      const fromMessages: Message[] = [
        { role: 'system', content: 'System' },
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi' }
      ];

      const toManager = new MessageManager();

      ContextSharing.shareContext(fromMessages, toManager, {
        includeSystem: true,
        maxMessages: 10
      });

      const sharedMessages = toManager.getMessages();
      expect(sharedMessages.length).toBeGreaterThan(0);
    });

    it('should filter by role', () => {
      const fromMessages: Message[] = [
        { role: 'system', content: 'System' },
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi' }
      ];

      const toManager = new MessageManager();

      ContextSharing.shareContext(fromMessages, toManager, {
        includeSystem: false,
        filterByRole: ['user']
      });

      const sharedMessages = toManager.getMessages();
      const userMessages = sharedMessages.filter(m => m.role === 'user');
      expect(userMessages.length).toBeGreaterThan(0);
    });
  });

  describe('mergeContexts', () => {
    it('should merge multiple contexts', () => {
      const context1: Message[] = [
        { role: 'user', content: 'Message 1' }
      ];
      const context2: Message[] = [
        { role: 'user', content: 'Message 2' }
      ];

      const merged = ContextSharing.mergeContexts([context1, context2]);

      expect(merged).toHaveLength(2);
      expect(merged[0].content).toBe('Message 1');
      expect(merged[1].content).toBe('Message 2');
    });

    it('should deduplicate messages', () => {
      const context1: Message[] = [
        { role: 'user', content: 'Same message' }
      ];
      const context2: Message[] = [
        { role: 'user', content: 'Same message' }
      ];

      const merged = ContextSharing.mergeContexts([context1, context2], {
        deduplicate: true
      });

      expect(merged).toHaveLength(1);
    });

    it('should limit merged messages', () => {
      const contexts = Array.from({ length: 5 }, () => [
        { role: 'user', content: 'Message' }
      ] as Message[]);

      const merged = ContextSharing.mergeContexts(contexts, {
        maxMessages: 3
      });

      expect(merged.length).toBeLessThanOrEqual(3);
    });
  });

  describe('createContextSummary', () => {
    it('should create summary of context', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi' },
        { role: 'user', content: 'How are you?' }
      ];

      const summary = ContextSharing.createContextSummary(messages);

      expect(summary).toContain('2 user messages');
      expect(summary).toContain('1 assistant messages');
    });
  });
});

