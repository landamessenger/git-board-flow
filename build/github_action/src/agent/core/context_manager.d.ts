/**
 * Context Manager
 * Manages conversation context and compression for long conversations
 */
import { Message } from '../types/message_types';
export interface ContextStats {
    messageCount: number;
    estimatedTokens: number;
    compressed: boolean;
}
export declare class ContextManager {
    private maxContextLength;
    private compressionEnabled;
    constructor(maxContextLength?: number, compressionEnabled?: boolean);
    /**
     * Estimate tokens in messages (rough approximation: 1 token ≈ 4 characters)
     */
    estimateTokens(messages: Message[]): number;
    /**
     * Check if context needs compression
     */
    needsCompression(messages: Message[]): boolean;
    /**
     * Compress context by summarizing old messages
     */
    compressContext(messages: Message[]): Message[];
    /**
     * Get context statistics
     */
    getStats(messages: Message[]): ContextStats;
    /**
     * Update max context length
     */
    setMaxContextLength(length: number): void;
    /**
     * Enable/disable compression
     */
    setCompressionEnabled(enabled: boolean): void;
}
