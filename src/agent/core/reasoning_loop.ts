/**
 * Reasoning Loop for Agent SDK
 * Manages the conversation loop with tool calling
 */

import { MessageManager } from './message_manager';
import { ToolExecutor } from '../tools/tool_executor';
import { AgentOptions, TurnResult, AgentResult, ParsedResponse } from '../types';
import { ResponseParser } from '../utils/response_parser';
import { PromptBuilder } from '../utils/prompt_builder';
import { ErrorHandler, APIError } from '../utils/error_handler';
import { AiRepository } from '../../data/repository/ai_repository';
import { Ai } from '../../data/model/ai';
import { AGENT_RESPONSE_SCHEMA } from '../types/response_schema';
import { logDebugInfo, logError, logInfo } from '../../utils/logger';

export class ReasoningLoop {
  private aiRepository: AiRepository;
  private ai: Ai;

  constructor(
    private messageManager: MessageManager,
    private toolExecutor: ToolExecutor,
    private options: AgentOptions
  ) {
    this.aiRepository = new AiRepository();
    this.ai = new Ai(
      '', // anthropicApiKey (not used)
      '', // anthropicModel (not used)
      options.apiKey,
      options.model,
      false, // aiPullRequestDescription
      false, // aiMembersOnly
      [], // aiIgnoreFiles
      false, // aiIncludeReasoning
      {} // providerRouting
    );
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

    while (turn < maxTurns) {
      turn++;
      logInfo(`🔄 Turn ${turn}/${maxTurns}`);

      try {
        // 1. Call API
        const response = await this.callAPI();

        // 2. Parse response
        const parsedResponse = this.parseResponse(response);

        // 3. Extract tool calls
        const toolCalls = parsedResponse.toolCalls || [];

        // 4. Create turn result
        const turnResult: TurnResult = {
          turnNumber: turn,
          assistantMessage: parsedResponse.text,
          toolCalls: toolCalls,
          reasoning: parsedResponse.reasoning,
          timestamp: Date.now()
        };

        // 5. Execute tools if any
        if (toolCalls.length > 0) {
          logInfo(`🔧 Executing ${toolCalls.length} tool call(s)`);
          
          const toolResults = await this.toolExecutor.executeAll(toolCalls);
          turnResult.toolResults = toolResults;
          allToolCalls.push(...toolCalls);

          // Log tool execution details
          for (let i = 0; i < toolCalls.length; i++) {
            const toolCall = toolCalls[i];
            const toolResult = toolResults[i];
            logDebugInfo(`🔧 Tool: ${toolCall.name} | Input: ${JSON.stringify(toolCall.input)} | Success: ${!toolResult.isError}`);
            if (toolResult.isError) {
              logError(`❌ Tool ${toolCall.name} error: ${toolResult.errorMessage}`);
            } else {
              const resultPreview = typeof toolResult.content === 'string' 
                ? toolResult.content.substring(0, 100) 
                : JSON.stringify(toolResult.content).substring(0, 100);
              logDebugInfo(`✅ Tool ${toolCall.name} result: ${resultPreview}...`);
            }
          }

          // Call callbacks
          for (const toolCall of toolCalls) {
            this.options.onToolCall?.(toolCall);
          }
          for (const result of toolResults) {
            this.options.onToolResult?.(result);
          }

          // 6. Add assistant message and tool results to history
          this.messageManager.addAssistantMessage(parsedResponse.text);
          this.messageManager.addToolResults(toolResults);

          turns.push(turnResult);
          this.options.onTurnComplete?.(turnResult);

          // 7. Continue loop
          continue;
        }

        // 8. No tool calls = final response
        logInfo(`✅ Final response received (no more tool calls)`);
        
        this.messageManager.addAssistantMessage(parsedResponse.text);
        turns.push(turnResult);
        this.options.onTurnComplete?.(turnResult);

        return {
          finalResponse: parsedResponse.text,
          turns: turns,
          toolCalls: allToolCalls,
          messages: this.messageManager.getMessages()
        };
      } catch (error) {
        const handledError = ErrorHandler.handle(error);
        logError(`❌ Error in turn ${turn}: ${handledError.message}`);

        this.options.onError?.(handledError);

        return {
          finalResponse: turns.length > 0 
            ? turns[turns.length - 1].assistantMessage 
            : 'Error occurred during reasoning',
          turns: turns,
          toolCalls: allToolCalls,
          messages: this.messageManager.getMessages(),
          error: handledError
        };
      }
    }

    // Max turns reached
    logInfo(`⚠️ Max turns (${maxTurns}) reached`);
    
    return {
      finalResponse: turns.length > 0 
        ? turns[turns.length - 1].assistantMessage 
        : 'Max turns reached',
      turns: turns,
      toolCalls: allToolCalls,
      messages: this.messageManager.getMessages(),
      truncated: true,
      error: new Error('Max turns reached')
    };
  }

  /**
   * Call OpenRouter API via AiRepository
   */
  private async callAPI(): Promise<any> {
    const messages = this.messageManager.getMessages();
    const toolDefinitions = this.toolExecutor.getToolDefinitions();

    // Build prompt
    const prompt = PromptBuilder.buildPrompt(messages, toolDefinitions);

    logDebugInfo(`📤 Calling API with ${messages.length} message(s) and ${toolDefinitions.length} tool(s)`);

    // Call via AiRepository with JSON schema
    const response = await this.aiRepository.askJson(
      this.ai,
      prompt,
      AGENT_RESPONSE_SCHEMA,
      'agent_response'
    );

    if (!response) {
      throw new APIError('No response from API');
    }

    return response;
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
}

