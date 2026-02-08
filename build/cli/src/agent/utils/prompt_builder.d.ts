/**
 * Prompt builder for Agent SDK
 * Builds prompts that include tool definitions and conversation history
 */
import { Message } from '../types';
import { ToolDefinition } from '../types';
export declare class PromptBuilder {
    /**
     * Build a complete prompt from messages and tools
     * This converts the message history into a format suitable for OpenCode
     */
    static buildPrompt(messages: Message[], tools?: ToolDefinition[]): string;
    /**
     * Build tools section for prompt (simplified to save tokens)
     */
    private static buildToolsSection;
    /**
     * Format a message for the prompt
     */
    private static formatMessage;
    /**
     * Get response schema for JSON mode
     */
    private static getResponseSchema;
}
