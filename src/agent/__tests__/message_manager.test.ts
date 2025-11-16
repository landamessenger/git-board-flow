/**
 * Tests for MessageManager
 */

import { MessageManager } from '../core/message_manager';
import { Message } from '../types';

describe('MessageManager', () => {
  let manager: MessageManager;

  beforeEach(() => {
    manager = new MessageManager();
  });

  describe('System Messages', () => {
    it('should add system message', () => {
      manager.addSystemMessage('You are a helpful assistant');
      
      expect(manager.hasSystemMessage()).toBe(true);
      expect(manager.getSystemMessage()).toBe('You are a helpful assistant');
    });

    it('should replace existing system message', () => {
      manager.addSystemMessage('First system message');
      manager.addSystemMessage('Second system message');
      
      expect(manager.getMessageCount()).toBe(1);
      expect(manager.getSystemMessage()).toBe('Second system message');
    });

    it('should add system message at the beginning', () => {
      manager.addUserMessage('User message');
      manager.addSystemMessage('System message');
      
      const messages = manager.getMessages();
      expect(messages[0].role).toBe('system');
      expect(messages[1].role).toBe('user');
    });
  });

  describe('User Messages', () => {
    it('should add user message', () => {
      manager.addUserMessage('Hello');
      
      expect(manager.getMessageCount()).toBe(1);
      const messages = manager.getMessages();
      expect(messages[0].role).toBe('user');
      expect(messages[0].content).toBe('Hello');
    });

    it('should add multiple user messages', () => {
      manager.addUserMessage('First');
      manager.addUserMessage('Second');
      
      expect(manager.getMessageCount()).toBe(2);
    });
  });

  describe('Assistant Messages', () => {
    it('should add assistant message', () => {
      manager.addAssistantMessage('Hello, how can I help?');
      
      expect(manager.getMessageCount()).toBe(1);
      const messages = manager.getMessages();
      expect(messages[0].role).toBe('assistant');
    });

    it('should convert string to content blocks', () => {
      manager.addAssistantMessage('Test message');
      
      const messages = manager.getMessages();
      const content = messages[0].content;
      
      expect(Array.isArray(content)).toBe(true);
      if (Array.isArray(content)) {
        expect(content[0]).toEqual({ type: 'text', text: 'Test message' });
      }
    });
  });

  describe('Tool Results', () => {
    it('should add tool results', () => {
      manager.addToolResults([
        {
          toolCallId: 'call_1',
          content: 'Result 1'
        },
        {
          toolCallId: 'call_2',
          content: 'Result 2',
          isError: true
        }
      ]);
      
      const messages = manager.getMessages();
      expect(messages[0].role).toBe('user');
      
      const content = messages[0].content;
      expect(Array.isArray(content)).toBe(true);
      
      if (Array.isArray(content)) {
        expect(content.length).toBe(2);
        expect(content[0]).toMatchObject({
          type: 'tool_result',
          tool_use_id: 'call_1',
          content: 'Result 1'
        });
        expect(content[1]).toMatchObject({
          type: 'tool_result',
          tool_use_id: 'call_2',
          content: 'Result 2',
          is_error: true
        });
      }
    });
  });

  describe('Message History', () => {
    it('should return all messages', () => {
      manager.addSystemMessage('System');
      manager.addUserMessage('User 1');
      manager.addAssistantMessage('Assistant 1');
      manager.addUserMessage('User 2');
      
      const messages = manager.getMessages();
      expect(messages.length).toBe(4);
      expect(messages[0].role).toBe('system');
      expect(messages[1].role).toBe('user');
      expect(messages[2].role).toBe('assistant');
      expect(messages[3].role).toBe('user');
    });

    it('should return copy of messages (immutability)', () => {
      manager.addUserMessage('Original');
      
      const messages1 = manager.getMessages();
      const messages2 = manager.getMessages();
      
      expect(messages1).not.toBe(messages2);
      expect(messages1).toEqual(messages2);
    });

    it('should get last message', () => {
      manager.addUserMessage('First');
      manager.addUserMessage('Last');
      
      const last = manager.getLastMessage();
      expect(last?.content).toBe('Last');
    });

    it('should return undefined for last message when empty', () => {
      expect(manager.getLastMessage()).toBeUndefined();
    });
  });

  describe('Reset', () => {
    it('should clear all messages', () => {
      manager.addSystemMessage('System');
      manager.addUserMessage('User');
      manager.addAssistantMessage('Assistant');
      
      manager.reset();
      
      expect(manager.getMessageCount()).toBe(0);
      expect(manager.hasSystemMessage()).toBe(false);
    });
  });
});

