/**
 * Message Manager for Agent SDK
 * Manages conversation history in Anthropic Messages API format
 */

import { Message, MessageRole, ContentBlock, ToolResultContent } from '../types';
import { ToolResult } from '../types';

export class MessageManager {
  private messages: Message[] = [];

  /**
   * Add system message (only one allowed, at the beginning)
   */
  addSystemMessage(content: string): void {
    // Remove existing system message if any
    this.messages = this.messages.filter(m => m.role !== 'system');
    
    // Add at the beginning
    this.messages.unshift({
      role: 'system',
      content
    });
  }

  /**
   * Add user message
   */
  addUserMessage(content: string | ContentBlock[]): void {
    this.messages.push({
      role: 'user',
      content
    });
  }

  /**
   * Add assistant message
   */
  addAssistantMessage(content: string | ContentBlock[]): void {
    // Convert string to ContentBlock if needed
    const contentBlocks: ContentBlock[] = typeof content === 'string'
      ? [{ type: 'text', text: content }]
      : content;

    this.messages.push({
      role: 'assistant',
      content: contentBlocks
    });
  }

  /**
   * Add tool results as user message
   */
  addToolResults(results: ToolResult[]): void {
    const content: ToolResultContent[] = results.map(r => ({
      type: 'tool_result',
      tool_use_id: r.toolCallId,
      content: r.content,
      is_error: r.isError
    }));

    this.messages.push({
      role: 'user',
      content
    });
  }

  /**
   * Get all messages
   */
  getMessages(): Message[] {
    return [...this.messages];
  }

  /**
   * Get messages count
   */
  getMessageCount(): number {
    return this.messages.length;
  }

  /**
   * Get last message
   */
  getLastMessage(): Message | undefined {
    return this.messages[this.messages.length - 1];
  }

  /**
   * Reset message history
   */
  reset(): void {
    this.messages = [];
  }

  /**
   * Check if has system message
   */
  hasSystemMessage(): boolean {
    return this.messages.some(m => m.role === 'system');
  }

  /**
   * Get system message if exists
   */
  getSystemMessage(): string | undefined {
    const systemMsg = this.messages.find(m => m.role === 'system');
    return systemMsg && typeof systemMsg.content === 'string' 
      ? systemMsg.content 
      : undefined;
  }
}

