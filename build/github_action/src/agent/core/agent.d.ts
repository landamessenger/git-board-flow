/**
 * Agent - Main class for Agent SDK
 * Similar to Anthropic's Agent SDK
 * Integrated with all advanced features
 */
import { BaseTool } from '../tools/base_tool';
import { AgentOptions, AgentResult, Message } from '../types';
export declare class Agent {
    private options;
    private messageManager;
    private toolRegistry;
    private toolExecutor;
    private reasoningLoop;
    private sessionManager;
    private sessionId;
    constructor(options: AgentOptions);
    /**
     * Execute query - main entry point
     * Similar to Agent SDK's query() method
     */
    query(prompt: string): Promise<AgentResult>;
    /**
     * Continue conversation with additional prompt
     */
    continue(prompt: string): Promise<AgentResult>;
    /**
     * Load session
     */
    loadSession(sessionId?: string): Promise<void>;
    /**
     * Save session
     */
    private saveSession;
    /**
     * Get session ID
     */
    getSessionId(): string;
    /**
     * List all sessions
     */
    listSessions(): Promise<import("./session_manager").SessionMetadata[]>;
    /**
     * Delete session
     */
    deleteSession(sessionId?: string): Promise<void>;
    /**
     * Get message history
     */
    getMessages(): Message[];
    /**
     * Get message count
     */
    getMessageCount(): number;
    /**
     * Reset agent (clear history)
     */
    reset(): void;
    /**
     * Register a tool
     */
    registerTool(tool: BaseTool): void;
    /**
     * Register multiple tools
     */
    registerTools(tools: BaseTool[]): void;
    /**
     * Get available tools
     */
    getAvailableTools(): string[];
    /**
     * Get system prompt
     */
    getSystemPrompt(): string | undefined;
    /**
     * Update system prompt
     */
    setSystemPrompt(prompt: string): void;
}
