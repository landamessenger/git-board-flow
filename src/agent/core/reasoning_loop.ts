/**
 * Reasoning Loop for Agent SDK
 * Manages the conversation loop with tool calling
 * Integrated with all advanced features: streaming, permissions, context, metrics, budget, timeouts, retry
 */

import { MessageManager } from './message_manager';
import { ToolExecutor } from '../tools/tool_executor';
import { AgentOptions, TurnResult, AgentResult, ParsedResponse, StreamChunk } from '../types';
import { ResponseParser } from '../utils/response_parser';
import { PromptBuilder } from '../utils/prompt_builder';
import { ErrorHandler, APIError } from '../utils/error_handler';
import { AiRepository } from '../../data/repository/ai_repository';
import { Ai } from '../../data/model/ai';
import { AGENT_RESPONSE_SCHEMA } from '../types/response_schema';
import { logDebugInfo, logError, logInfo, logWarn } from '../../utils/logger';
import { ToolPermissionsManager } from './tool_permissions';
import { ContextManager } from './context_manager';
import { MetricsTracker } from './metrics_tracker';
import { BudgetManager } from './budget_manager';
import { RetryManager } from './retry_manager';

export class ReasoningLoop {
  private aiRepository: AiRepository;
  private ai: Ai;
  private permissionsManager: ToolPermissionsManager;
  private contextManager: ContextManager;
  private metricsTracker: MetricsTracker;
  private budgetManager: BudgetManager;
  private retryManager: RetryManager;
  private sessionStartTime: number;
  private timeoutId?: NodeJS.Timeout;

  constructor(
    private messageManager: MessageManager,
    private toolExecutor: ToolExecutor,
    private options: AgentOptions
  ) {
    this.aiRepository = new AiRepository();
    this.ai = new Ai(
      options.apiKey,
      options.model,
      false, // aiPullRequestDescription
      false, // aiMembersOnly
      [], // aiIgnoreFiles
      false, // aiIncludeReasoning
      {} // providerRouting
    );

    // Initialize managers
    this.permissionsManager = new ToolPermissionsManager(options.toolPermissions);
    this.contextManager = new ContextManager(
      options.maxContextLength || 100000,
      options.contextCompressionEnabled !== false
    );
    this.metricsTracker = new MetricsTracker();
    this.budgetManager = new BudgetManager(options.budget);
    this.retryManager = new RetryManager(options.retry);
    this.sessionStartTime = Date.now();

    // Set up session timeout
    if (options.timeouts?.totalSession) {
      this.timeoutId = setTimeout(() => {
        logWarn('⏱️ Session timeout reached');
      }, options.timeouts.totalSession);
    }
  }

  /**
   * Execute the reasoning loop
   */
  async execute(): Promise<AgentResult> {
    const turns: TurnResult[] = [];
    const allToolCalls: any[] = [];
    let turn = 0;
    const maxTurns = this.options.maxTurns || 30;

    logInfo(`🔄 Starting reasoning loop (max turns: ${maxTurns})`);

    try {
      while (turn < maxTurns) {
        // Check timeout
        if (this.options.timeouts?.totalSession) {
          const elapsed = Date.now() - this.sessionStartTime;
          if (elapsed > this.options.timeouts.totalSession) {
            logWarn('⏱️ Session timeout exceeded');
            return this.createResult(turns, allToolCalls, undefined, true);
          }
        }

        turn++;
        logInfo(`🔄 Turn ${turn}/${maxTurns}`);

        try {
          // 1. Compress context if needed
          const messages = this.messageManager.getMessages();
          if (this.contextManager.needsCompression(messages)) {
            const compressed = this.contextManager.compressContext(messages);
            // Note: MessageManager doesn't support direct replacement, so we'd need to reset and rebuild
            // For now, we'll just log the stats
            const stats = this.contextManager.getStats(messages);
            logDebugInfo(`📊 Context: ${stats.messageCount} messages, ~${stats.estimatedTokens} tokens`);
          }

          // 2. Call API with retry, timeout, and streaming
          const apiStartTime = Date.now();
          const response = await this.callAPIWithRetry();
          const apiLatency = Date.now() - apiStartTime;

          // Estimate tokens (rough approximation)
          const inputTokens = Math.ceil(this.estimateInputTokens() / 4);
          const outputTokens = Math.ceil((response?.response?.length || 0) / 4);
          
          // Record metrics
          if (this.options.trackMetrics !== false) {
            this.metricsTracker.recordAPICall(inputTokens, outputTokens, apiLatency);
          }

          // 3. Parse response
          const parsedResponse = this.parseResponse(response);

          // 4. Filter tool calls by permissions
          let toolCalls = parsedResponse.toolCalls || [];
          const originalCount = toolCalls.length;
          toolCalls = toolCalls.filter(tc => this.permissionsManager.isAllowed(tc.name));
          
          if (originalCount > toolCalls.length) {
            logWarn(`🚫 Filtered ${originalCount - toolCalls.length} tool call(s) due to permissions`);
          }

          // 5. Create turn result
          const turnResult: TurnResult = {
            turnNumber: turn,
            assistantMessage: parsedResponse.text,
            toolCalls: toolCalls,
            reasoning: parsedResponse.reasoning,
            timestamp: Date.now()
          };

          // 6. Execute tools if any
          if (toolCalls.length > 0) {
            logInfo(`🔧 Executing ${toolCalls.length} tool call(s)`);
      for (const toolCall of toolCalls) {
        logInfo(`   🔨 Tool: ${toolCall.name}`);
        logInfo(`      Input: ${JSON.stringify(toolCall.input).substring(0, 150)}${JSON.stringify(toolCall.input).length > 150 ? '...' : ''}`);
      }
            
            // Record tool calls in metrics
            for (const _ of toolCalls) {
              this.metricsTracker.recordToolCall();
            }

            const toolResults = await this.executeToolsWithTimeout(toolCalls);
            turnResult.toolResults = toolResults;
            allToolCalls.push(...toolCalls);

            // Log tool execution details
            for (let i = 0; i < toolCalls.length; i++) {
              const toolCall = toolCalls[i];
              const toolResult = toolResults[i];
              
              logInfo(`   ✅ Tool result (${toolCall.name}):`);
              if (toolResult.isError) {
                logError(`      ❌ Error: ${toolResult.errorMessage || 'Unknown error'}`);
                this.metricsTracker.recordError();
              } else {
                const resultPreview = typeof toolResult.content === 'string' 
                  ? toolResult.content.substring(0, 500)
                  : JSON.stringify(toolResult.content).substring(0, 500);
                logInfo(`      ${resultPreview}${(typeof toolResult.content === 'string' && toolResult.content.length > 500) || (typeof toolResult.content !== 'string' && JSON.stringify(toolResult.content).length > 500) ? '...' : ''}`);
              }
            }

            // Call callbacks
            for (const toolCall of toolCalls) {
              this.options.onToolCall?.(toolCall);
            }
            for (const result of toolResults) {
              this.options.onToolResult?.(result);
            }

            // 7. Add assistant message and tool results to history
            this.messageManager.addAssistantMessage(parsedResponse.text);
            this.messageManager.addToolResults(toolResults);

            turns.push(turnResult);
            this.options.onTurnComplete?.(turnResult);

            // Check budget
            const metrics = this.metricsTracker.getMetrics();
            if (this.budgetManager.isExceeded(metrics)) {
              logWarn('💰 Budget exceeded! Stopping execution.');
              return this.createResult(turns, allToolCalls, parsedResponse.text, false, true);
            }
            this.budgetManager.logStatus(metrics);

            // 8. Continue loop
            continue;
          }

          // 9. No tool calls = final response
          // Log the response to see what the agent is saying
          if (parsedResponse.text) {
            logInfo(`   📝 Final response: ${parsedResponse.text}`);
          }
          logInfo(`✅ Final response received (no more tool calls)`);
          
          this.messageManager.addAssistantMessage(parsedResponse.text);
          turns.push(turnResult);
          this.options.onTurnComplete?.(turnResult);

          // Get final metrics
          const finalMetrics = this.metricsTracker.getMetrics();
          if (this.options.onMetrics) {
            this.options.onMetrics(finalMetrics);
          }

          return this.createResult(turns, allToolCalls, parsedResponse.text);
        } catch (error) {
          const handledError = ErrorHandler.handle(error);
          logError(`❌ Error in turn ${turn}: ${handledError.message}`);
          this.metricsTracker.recordError();

          this.options.onError?.(handledError);

          return this.createResult(turns, allToolCalls, undefined, false, false, handledError);
        }
      }

      // Max turns reached
      logInfo(`⚠️ Max turns (${maxTurns}) reached`);
      
      return this.createResult(turns, allToolCalls, undefined, true);
    } finally {
      // Cleanup
      if (this.timeoutId) {
        clearTimeout(this.timeoutId);
      }
    }
  }

  /**
   * Call API with retry logic
   */
  private async callAPIWithRetry(): Promise<any> {
    return this.retryManager.execute(async () => {
      return await this.callAPI();
    }, (error, attempt) => {
      // Custom error handler for API errors
      if (error instanceof APIError) {
        return true; // Retry API errors
      }
      return false;
    });
  }

  /**
   * Call OpenRouter API via AiRepository
   */
  private async callAPI(): Promise<any> {
    const messages = this.messageManager.getMessages();
    const toolDefinitions = this.toolExecutor.getToolDefinitions();

    // Filter tools by permissions
    const allowedToolNames = this.permissionsManager.filterAllowed(
      toolDefinitions.map(t => t.name)
    );
    const filteredTools = toolDefinitions.filter(t => allowedToolNames.includes(t.name));

    // Build prompt
    const prompt = PromptBuilder.buildPrompt(messages, filteredTools);

    logDebugInfo(`📤 Calling API with ${messages.length} message(s) and ${filteredTools.length} tool(s)`);

    // Handle streaming
    if (this.options.streaming && this.options.onStreamChunk) {
      let streamedContent = '';
      
      const onChunk = (chunk: string) => {
        streamedContent += chunk;
        this.options.onStreamChunk!({
          type: 'text',
          content: chunk
        });
      };

      // Call with streaming
      // Use strict: false for Agent SDK because input is generic (varies by tool)
      // Individual tool schemas (like report_errors) are still strict and validated
      const response = await Promise.race([
        this.aiRepository.askJson(
          this.ai,
          prompt,
          AGENT_RESPONSE_SCHEMA,
          'agent_response',
          true,
          onChunk,
          false  // strict: false for Agent SDK (input is generic)
        ),
        this.createTimeoutPromise(this.options.timeouts?.apiCall)
      ]);

      if (!response) {
        throw new APIError('No response from API');
      }

      // Send done chunk
      this.options.onStreamChunk!({
        type: 'done',
        content: ''
      });

      return response;
    }

    // Non-streaming call with timeout
    // Use strict: false for Agent SDK because input is generic (varies by tool)
    // Individual tool schemas (like report_errors) are still strict and validated
    const response = await Promise.race([
      this.aiRepository.askJson(
        this.ai,
        prompt,
        AGENT_RESPONSE_SCHEMA,
        'agent_response',
        false,  // streaming: false
        undefined,  // onChunk: undefined
        false  // strict: false for Agent SDK (input is generic)
      ),
      this.createTimeoutPromise(this.options.timeouts?.apiCall)
    ]);

    if (!response) {
      throw new APIError('No response from API');
    }

    return response;
  }

  /**
   * Execute tools with timeout
   */
  private async executeToolsWithTimeout(toolCalls: any[]): Promise<any[]> {
    const timeout = this.options.timeouts?.toolExecution;
    
    if (timeout) {
      return Promise.race([
        this.toolExecutor.executeAll(toolCalls),
        this.createTimeoutPromise(timeout).then(() => {
          throw new Error('Tool execution timeout');
        })
      ]);
    }

    return this.toolExecutor.executeAll(toolCalls);
  }

  /**
   * Create timeout promise
   */
  private createTimeoutPromise(timeout?: number): Promise<never> {
    return new Promise((_, reject) => {
      if (!timeout) {
        // No timeout, never reject
        return;
      }
      setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeout}ms`));
      }, timeout);
    });
  }

  /**
   * Estimate input tokens (rough approximation)
   */
  private estimateInputTokens(): number {
    const messages = this.messageManager.getMessages();
    return this.contextManager.estimateTokens(messages);
  }

  /**
   * Parse API response
   */
  private parseResponse(response: any): ParsedResponse {
    try {
      const parsed = ResponseParser.parse(response);
      
      if (!ResponseParser.validate(parsed)) {
        throw new Error('Invalid parsed response format');
      }

      return parsed;
    } catch (error) {
      throw new APIError(
        `Failed to parse response: ${error instanceof Error ? error.message : String(error)}`,
        undefined,
        response
      );
    }
  }

  /**
   * Create result object
   */
  private createResult(
    turns: TurnResult[],
    toolCalls: any[],
    finalResponse?: string,
    truncated: boolean = false,
    budgetExceeded: boolean = false,
    error?: Error
  ): AgentResult {
    const metrics = this.options.trackMetrics !== false 
      ? this.metricsTracker.getMetrics()
      : undefined;

    return {
      finalResponse: finalResponse || (turns.length > 0 
        ? turns[turns.length - 1].assistantMessage 
        : 'No response'),
      turns: turns,
      toolCalls: toolCalls,
      messages: this.messageManager.getMessages(),
      totalTokens: metrics ? {
        input: metrics.totalTokens.input,
        output: metrics.totalTokens.output
      } : undefined,
      metrics: metrics,
      error: error,
      truncated: truncated,
      budgetExceeded: budgetExceeded,
      timeoutExceeded: truncated && !error
    };
  }
}
