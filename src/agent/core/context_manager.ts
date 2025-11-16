/**
 * Context Manager
 * Manages conversation context and compression for long conversations
 */

import { Message } from '../types/message_types';
import { logDebugInfo } from '../../utils/logger';

export interface ContextStats {
  messageCount: number;
  estimatedTokens: number;
  compressed: boolean;
}

export class ContextManager {
  private maxContextLength: number;
  private compressionEnabled: boolean;

  constructor(maxContextLength: number = 100000, compressionEnabled: boolean = true) {
    this.maxContextLength = maxContextLength;
    this.compressionEnabled = compressionEnabled;
  }

  /**
   * Estimate tokens in messages (rough approximation: 1 token ≈ 4 characters)
   */
  estimateTokens(messages: Message[]): number {
    let totalChars = 0;
    
    for (const msg of messages) {
      if (typeof msg.content === 'string') {
        totalChars += msg.content.length;
      } else if (Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block.type === 'text' && 'text' in block) {
            totalChars += block.text.length;
          } else if (block.type === 'tool_use' && 'input' in block) {
            totalChars += JSON.stringify(block.input).length;
          } else if (block.type === 'tool_result' && 'content' in block) {
            const content = block.content;
            totalChars += typeof content === 'string' ? content.length : JSON.stringify(content).length;
          }
        }
      }
    }
    
    return Math.ceil(totalChars / 4);
  }

  /**
   * Check if context needs compression
   */
  needsCompression(messages: Message[]): boolean {
    if (!this.compressionEnabled) {
      return false;
    }
    
    const tokens = this.estimateTokens(messages);
    return tokens > this.maxContextLength * 0.8; // Compress at 80% of max
  }

  /**
   * Compress context by summarizing old messages
   */
  compressContext(messages: Message[]): Message[] {
    if (!this.needsCompression(messages)) {
      return messages;
    }

    logDebugInfo(`📦 Compressing context (${messages.length} messages, ~${this.estimateTokens(messages)} tokens)`);

    // Keep system message
    const systemMessage = messages.find(m => m.role === 'system');
    const otherMessages = messages.filter(m => m.role !== 'system');

    // Keep recent messages (last 10)
    const recentMessages = otherMessages.slice(-10);
    
    // Summarize older messages
    const oldMessages = otherMessages.slice(0, -10);
    const summary: Message = {
      role: 'user',
      content: `[Previous conversation summary: ${oldMessages.length} messages were exchanged. Key points: The conversation involved multiple tool calls and responses.]`
    };

    const compressed = systemMessage 
      ? [systemMessage, summary, ...recentMessages]
      : [summary, ...recentMessages];

    logDebugInfo(`✅ Compressed to ${compressed.length} messages (~${this.estimateTokens(compressed)} tokens)`);

    return compressed;
  }

  /**
   * Get context statistics
   */
  getStats(messages: Message[]): ContextStats {
    const tokens = this.estimateTokens(messages);
    const compressed = this.needsCompression(messages);

    return {
      messageCount: messages.length,
      estimatedTokens: tokens,
      compressed
    };
  }

  /**
   * Update max context length
   */
  setMaxContextLength(length: number): void {
    this.maxContextLength = length;
  }

  /**
   * Enable/disable compression
   */
  setCompressionEnabled(enabled: boolean): void {
    this.compressionEnabled = enabled;
  }
}

