/**
 * Agent - Main class for Agent SDK
 * Similar to Anthropic's Agent SDK
 * Integrated with all advanced features
 */
import { BaseTool } from '../tools/base_tool';
import { AgentOptions, AgentResult, Message } from '../types';
import { MCPManager } from '../mcp/mcp_manager';
import { MCPServerConfig } from '../mcp/types';
import { SubAgentManager, SubAgentOptions, Task } from './subagent_manager';
export declare class Agent {
    private options;
    private messageManager;
    private toolRegistry;
    private toolExecutor;
    private reasoningLoop;
    private sessionManager;
    private mcpManager?;
    private subAgentManager?;
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
    /**
     * Initialize MCP connections
     */
    initializeMCP(configPath?: string): Promise<void>;
    /**
     * Connect to an MCP server
     */
    connectMCPServer(config: MCPServerConfig): Promise<void>;
    /**
     * Get MCP manager
     */
    getMCPManager(): MCPManager | undefined;
    /**
     * Check if MCP server is connected
     */
    isMCPConnected(serverName: string): boolean;
    /**
     * Get connected MCP servers
     */
    getConnectedMCPServers(): string[];
    /**
     * Create a subagent
     */
    createSubAgent(options: SubAgentOptions): Agent;
    /**
     * Execute multiple tasks in parallel using subagents
     */
    executeParallel(tasks: Task[]): Promise<Array<{
        task: string;
        result: AgentResult;
    }>>;
    /**
     * Coordinate agents with dependencies
     */
    coordinateAgents(tasks: Array<Task & {
        dependsOn?: string[];
    }>): Promise<Array<{
        task: string;
        result: AgentResult;
    }>>;
    /**
     * Get subagent manager
     */
    getSubAgentManager(): SubAgentManager | undefined;
    /**
     * Get subagent by name
     */
    getSubAgent(name: string): Agent | undefined;
    /**
     * Get all subagents
     */
    getAllSubAgents(): Agent[];
}
