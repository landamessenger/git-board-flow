/**
 * Agent - Main class for Agent SDK
 * Similar to Anthropic's Agent SDK
 */

import { MessageManager } from './message_manager';
import { ReasoningLoop } from './reasoning_loop';
import { ToolRegistry } from '../tools/tool_registry';
import { ToolExecutor } from '../tools/tool_executor';
import { BaseTool } from '../tools/base_tool';
import { AgentOptions, AgentResult, Message } from '../types';
import { logInfo } from '../../utils/logger';

export class Agent {
  private messageManager: MessageManager;
  private toolRegistry: ToolRegistry;
  private toolExecutor: ToolExecutor;
  private reasoningLoop: ReasoningLoop | null = null;

  constructor(private options: AgentOptions) {
    // Validate options
    if (!options.model) {
      throw new Error('Model is required');
    }
    if (!options.apiKey) {
      throw new Error('API key is required');
    }

    // Initialize components
    this.messageManager = new MessageManager();
    this.toolRegistry = new ToolRegistry();
    this.toolExecutor = new ToolExecutor(this.toolRegistry);

    // Register tools if provided
    if (options.tools && options.tools.length > 0) {
      this.toolRegistry.registerAll(options.tools);
      logInfo(`🔧 Registered ${options.tools.length} tool(s)`);
    }

    // Add system prompt if provided
    if (options.systemPrompt) {
      this.messageManager.addSystemMessage(options.systemPrompt);
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

    logInfo(`✅ Agent continued (${result.turns.length} turn(s))`);

    return result;
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
}

