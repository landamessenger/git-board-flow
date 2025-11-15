/**
 * Context Sharing
 * Manages sharing context between agents
 */
import { Message } from '../types';
import { MessageManager } from './message_manager';
export interface SharedContext {
    messages: Message[];
    metadata?: Record<string, any>;
}
export declare class ContextSharing {
    /**
     * Extract relevant messages from an agent
     */
    static extractRelevantMessages(messages: Message[], maxMessages?: number): Message[];
    /**
     * Share context between agents
     */
    static shareContext(fromMessages: Message[], toMessageManager: MessageManager, options?: {
        includeSystem?: boolean;
        maxMessages?: number;
        filterByRole?: ('user' | 'assistant' | 'system')[];
    }): void;
    /**
     * Merge contexts from multiple agents
     */
    static mergeContexts(contexts: Message[][], options?: {
        deduplicate?: boolean;
        maxMessages?: number;
    }): Message[];
    /**
     * Create a summary of context for sharing
     */
    static createContextSummary(messages: Message[]): string;
}
