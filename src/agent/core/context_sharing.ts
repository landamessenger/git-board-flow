/**
 * Context Sharing
 * Manages sharing context between agents
 */

import { Message } from '../types';
import { MessageManager } from './message_manager';
import { logDebugInfo } from '../../utils/logger';

export interface SharedContext {
  messages: Message[];
  metadata?: Record<string, any>;
}

export class ContextSharing {
  /**
   * Extract relevant messages from an agent
   */
  static extractRelevantMessages(
    messages: Message[],
    maxMessages: number = 10
  ): Message[] {
    // Keep system messages and recent messages
    const systemMessages = messages.filter(m => m.role === 'system');
    const recentMessages = messages
      .filter(m => m.role !== 'system')
      .slice(-maxMessages);
    
    return [...systemMessages, ...recentMessages];
  }

  /**
   * Share context between agents
   */
  static shareContext(
    fromMessages: Message[],
    toMessageManager: MessageManager,
    options: {
      includeSystem?: boolean;
      maxMessages?: number;
      filterByRole?: ('user' | 'assistant' | 'system')[];
    } = {}
  ): void {
    const {
      includeSystem = true,
      maxMessages = 10,
      filterByRole = ['user', 'assistant', 'system']
    } = options;

    let relevantMessages = fromMessages;

    // Filter by role
    if (filterByRole.length > 0) {
      relevantMessages = relevantMessages.filter(m => 
        filterByRole.includes(m.role as any)
      );
    }

    // Exclude system if not needed
    if (!includeSystem) {
      relevantMessages = relevantMessages.filter(m => m.role !== 'system');
    }

    // Limit messages
    relevantMessages = relevantMessages.slice(-maxMessages);

    // Add to target message manager
    for (const msg of relevantMessages) {
      if (msg.role === 'system' && includeSystem) {
        toMessageManager.addSystemMessage(
          typeof msg.content === 'string' ? msg.content : ''
        );
      } else if (msg.role === 'user') {
        toMessageManager.addUserMessage(msg.content);
      } else if (msg.role === 'assistant') {
        toMessageManager.addAssistantMessage(msg.content);
      }
    }

    logDebugInfo(`📤 Shared ${relevantMessages.length} messages between agents`);
  }

  /**
   * Merge contexts from multiple agents
   */
  static mergeContexts(
    contexts: Message[][],
    options: {
      deduplicate?: boolean;
      maxMessages?: number;
    } = {}
  ): Message[] {
    const { deduplicate = true, maxMessages = 20 } = options;

    // Flatten all messages
    let allMessages: Message[] = [];
    for (const context of contexts) {
      allMessages.push(...context);
    }

    // Deduplicate if needed
    if (deduplicate) {
      const seen = new Set<string>();
      allMessages = allMessages.filter(msg => {
        const key = `${msg.role}:${JSON.stringify(msg.content)}`;
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });
    }

    // Sort by timestamp if available, otherwise keep order
    // (Messages don't have timestamps in our current implementation,
    // so we'll keep the order from contexts)

    // Limit messages
    return allMessages.slice(-maxMessages);
  }

  /**
   * Create a summary of context for sharing
   */
  static createContextSummary(messages: Message[]): string {
    const userMessages = messages.filter(m => m.role === 'user').length;
    const assistantMessages = messages.filter(m => m.role === 'assistant').length;
    const toolCalls = messages.filter(m => 
      m.role === 'assistant' && 
      typeof m.content !== 'string' &&
      Array.isArray(m.content) &&
      m.content.some((block: any) => block.type === 'tool_use')
    ).length;

    return `Context summary: ${userMessages} user messages, ${assistantMessages} assistant messages, ${toolCalls} tool calls`;
  }
}

