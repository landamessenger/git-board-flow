/**
 * Message Manager for Agent SDK
 * Manages conversation history in Anthropic Messages API format
 */
import { Message, ContentBlock } from '../types';
import { ToolResult } from '../types';
export declare class MessageManager {
    private messages;
    /**
     * Add system message (only one allowed, at the beginning)
     */
    addSystemMessage(content: string): void;
    /**
     * Add user message
     */
    addUserMessage(content: string | ContentBlock[]): void;
    /**
     * Add assistant message
     */
    addAssistantMessage(content: string | ContentBlock[]): void;
    /**
     * Add tool results as user message
     */
    addToolResults(results: ToolResult[]): void;
    /**
     * Get all messages
     */
    getMessages(): Message[];
    /**
     * Get messages count
     */
    getMessageCount(): number;
    /**
     * Get last message
     */
    getLastMessage(): Message | undefined;
    /**
     * Reset message history
     */
    reset(): void;
    /**
     * Check if has system message
     */
    hasSystemMessage(): boolean;
    /**
     * Get system message if exists
     */
    getSystemMessage(): string | undefined;
}
