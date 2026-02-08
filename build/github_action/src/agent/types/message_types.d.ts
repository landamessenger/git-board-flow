/**
 * Message types for the Agent SDK
 * Compatible with Anthropic Messages API format
 */
export type MessageRole = 'system' | 'user' | 'assistant';
export interface TextContent {
    type: 'text';
    text: string;
}
export interface ToolUseContent {
    type: 'tool_use';
    id: string;
    name: string;
    input: Record<string, any>;
}
export interface ToolResultContent {
    type: 'tool_result';
    tool_use_id: string;
    content: string | any;
    is_error?: boolean;
}
export type ContentBlock = TextContent | ToolUseContent | ToolResultContent;
export interface Message {
    role: MessageRole;
    content: string | ContentBlock[];
}
export interface SystemMessage extends Message {
    role: 'system';
    content: string;
}
export interface UserMessage extends Message {
    role: 'user';
    content: string | ContentBlock[];
}
export interface AssistantMessage extends Message {
    role: 'assistant';
    content: ContentBlock[];
}
