/**
 * Agent - Main class for Agent SDK
 * Similar to Anthropic's Agent SDK
 * Integrated with all advanced features
 */

import { MessageManager } from './message_manager';
import { ReasoningLoop } from './reasoning_loop';
import { ToolRegistry } from '../tools/tool_registry';
import { ToolExecutor } from '../tools/tool_executor';
import { BaseTool } from '../tools/base_tool';
import { AgentOptions, AgentResult, Message } from '../types';
import { SessionManager, SessionData } from './session_manager';
import { MCPManager } from '../mcp/mcp_manager';
import { MCPServerConfig } from '../mcp/types';
import { SubAgentManager, SubAgentOptions, Task } from './subagent_manager';
import { logInfo } from '../../utils/logger';

export class Agent {
  private messageManager: MessageManager;
  private toolRegistry: ToolRegistry;
  private toolExecutor: ToolExecutor;
  private reasoningLoop: ReasoningLoop | null = null;
  private sessionManager: SessionManager;
  private mcpManager?: MCPManager;
  private subAgentManager?: SubAgentManager;
  private sessionId: string;

  constructor(private options: AgentOptions) {
    // Validate options
    if (!options.model) {
      throw new Error('Model is required');
    }
    if (!options.serverUrl) {
      throw new Error('OpenCode server URL is required');
    }

    // Initialize components
    this.messageManager = new MessageManager();
    this.toolRegistry = new ToolRegistry();
    this.toolExecutor = new ToolExecutor(this.toolRegistry);
    this.sessionManager = new SessionManager();

    // Generate or use provided session ID
    this.sessionId = options.sessionId || this.sessionManager.generateSessionId();

    // Note: Session loading should be done explicitly via loadSession() method
    // after construction, as it's async

    // Register tools if provided
    if (options.tools && options.tools.length > 0) {
      this.toolRegistry.registerAll(options.tools);
      logInfo(`🔧 Registered ${options.tools.length} tool(s)`);
    }

    // Add system prompt if provided
    if (options.systemPrompt) {
      this.messageManager.addSystemMessage(options.systemPrompt);
    }

    // Initialize MCP if enabled
    if (options.enableMCP !== false) {
      this.mcpManager = new MCPManager(this.toolRegistry);
      // MCP initialization is async, so we'll do it lazily or via initializeMCP()
    }
  }

  /**
   * Execute query - main entry point
   * Similar to Agent SDK's query() method
   */
  async query(prompt: string): Promise<AgentResult> {
    logInfo(`🚀 Agent query started`);

    // Add user message
    this.messageManager.addUserMessage(prompt);

    // Create reasoning loop
    this.reasoningLoop = new ReasoningLoop(
      this.messageManager,
      this.toolExecutor,
      this.options
    );

    // Execute
    const result = await this.reasoningLoop.execute();

    // Save session if enabled
    if (this.options.persistSession) {
      await this.saveSession(result);
    }

    logInfo(`✅ Agent query completed (${result.turns.length} turn(s), ${result.toolCalls.length} tool call(s))`);

    return result;
  }

  /**
   * Continue conversation with additional prompt
   */
  async continue(prompt: string): Promise<AgentResult> {
    logInfo(`🔄 Agent continuing conversation`);

    // Add user message
    this.messageManager.addUserMessage(prompt);

    // Create reasoning loop
    this.reasoningLoop = new ReasoningLoop(
      this.messageManager,
      this.toolExecutor,
      this.options
    );

    // Execute
    const result = await this.reasoningLoop.execute();

    // Save session if enabled
    if (this.options.persistSession) {
      await this.saveSession(result);
    }

    logInfo(`✅ Agent continued (${result.turns.length} turn(s))`);

    return result;
  }

  /**
   * Load session
   */
  async loadSession(sessionId?: string): Promise<void> {
    const id = sessionId || this.sessionId;
    const session = await this.sessionManager.loadSession(id);
    if (session) {
      // Reset current messages
      this.messageManager.reset();
      
      // Restore messages
      for (const msg of session.messages) {
        if (msg.role === 'system') {
          this.messageManager.addSystemMessage(typeof msg.content === 'string' ? msg.content : '');
        } else if (msg.role === 'user') {
          this.messageManager.addUserMessage(msg.content);
        } else if (msg.role === 'assistant') {
          this.messageManager.addAssistantMessage(msg.content);
        }
      }
      this.sessionId = id;
      logInfo(`📂 Session loaded: ${id} (${session.messages.length} messages)`);
    }
  }

  /**
   * Save session
   */
  private async saveSession(result: AgentResult): Promise<void> {
    try {
      await this.sessionManager.saveSession(
        this.sessionId,
        this.messageManager.getMessages(),
        result
      );
    } catch (error) {
      logInfo(`⚠️ Failed to save session: ${error}`);
    }
  }

  /**
   * Get session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * List all sessions
   */
  async listSessions() {
    return await this.sessionManager.listSessions();
  }

  /**
   * Delete session
   */
  async deleteSession(sessionId?: string): Promise<void> {
    const id = sessionId || this.sessionId;
    await this.sessionManager.deleteSession(id);
  }

  /**
   * Get message history
   */
  getMessages(): Message[] {
    return this.messageManager.getMessages();
  }

  /**
   * Get message count
   */
  getMessageCount(): number {
    return this.messageManager.getMessageCount();
  }

  /**
   * Reset agent (clear history)
   */
  reset(): void {
    this.messageManager.reset();
    if (this.options.systemPrompt) {
      this.messageManager.addSystemMessage(this.options.systemPrompt);
    }
    logInfo(`🔄 Agent reset`);
  }

  /**
   * Register a tool
   */
  registerTool(tool: BaseTool): void {
    this.toolRegistry.register(tool);
    logInfo(`🔧 Tool registered: ${tool.getName()}`);
  }

  /**
   * Register multiple tools
   */
  registerTools(tools: BaseTool[]): void {
    this.toolRegistry.registerAll(tools);
    logInfo(`🔧 Registered ${tools.length} tool(s)`);
  }

  /**
   * Get available tools
   */
  getAvailableTools(): string[] {
    return this.toolRegistry.getToolNames();
  }

  /**
   * Get system prompt
   */
  getSystemPrompt(): string | undefined {
    return this.messageManager.getSystemMessage();
  }

  /**
   * Update system prompt
   */
  setSystemPrompt(prompt: string): void {
    this.messageManager.addSystemMessage(prompt);
  }

  /**
   * Initialize MCP connections
   */
  async initializeMCP(configPath?: string): Promise<void> {
    if (!this.mcpManager) {
      this.mcpManager = new MCPManager(this.toolRegistry);
    }
    await this.mcpManager.initialize(configPath);
  }

  /**
   * Connect to an MCP server
   */
  async connectMCPServer(config: MCPServerConfig): Promise<void> {
    if (!this.mcpManager) {
      this.mcpManager = new MCPManager(this.toolRegistry);
    }
    await this.mcpManager.connectServer(config);
  }

  /**
   * Get MCP manager
   */
  getMCPManager(): MCPManager | undefined {
    return this.mcpManager;
  }

  /**
   * Check if MCP server is connected
   */
  isMCPConnected(serverName: string): boolean {
    return this.mcpManager?.isConnected(serverName) || false;
  }

  /**
   * Get connected MCP servers
   */
  getConnectedMCPServers(): string[] {
    return this.mcpManager?.getConnectedServers() || [];
  }

  /**
   * Create a subagent
   */
  createSubAgent(options: SubAgentOptions): Agent {
    if (!this.subAgentManager) {
      this.subAgentManager = new SubAgentManager(this);
    }
    return this.subAgentManager.createSubAgent(options);
  }

  /**
   * Execute multiple tasks in parallel using subagents
   */
  async executeParallel(tasks: Task[]): Promise<Array<{ task: string; result: AgentResult }>> {
    if (!this.subAgentManager) {
      this.subAgentManager = new SubAgentManager(this);
    }
    return await this.subAgentManager.executeParallel(tasks);
  }

  /**
   * Coordinate agents with dependencies
   */
  async coordinateAgents(
    tasks: Array<Task & { dependsOn?: string[] }>
  ): Promise<Array<{ task: string; result: AgentResult }>> {
    if (!this.subAgentManager) {
      this.subAgentManager = new SubAgentManager(this);
    }
    return await this.subAgentManager.coordinateAgents(tasks);
  }

  /**
   * Get subagent manager
   */
  getSubAgentManager(): SubAgentManager | undefined {
    return this.subAgentManager;
  }

  /**
   * Get subagent by name
   */
  getSubAgent(name: string): Agent | undefined {
    return this.subAgentManager?.getSubAgent(name);
  }

  /**
   * Get all subagents
   */
  getAllSubAgents(): Agent[] {
    return this.subAgentManager?.getAllSubAgents() || [];
  }
}

