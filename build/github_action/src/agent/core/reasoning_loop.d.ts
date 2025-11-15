/**
 * Reasoning Loop for Agent SDK
 * Manages the conversation loop with tool calling
 */
import { MessageManager } from './message_manager';
import { ToolExecutor } from '../tools/tool_executor';
import { AgentOptions, AgentResult } from '../types';
export declare class ReasoningLoop {
    private messageManager;
    private toolExecutor;
    private options;
    private aiRepository;
    private ai;
    constructor(messageManager: MessageManager, toolExecutor: ToolExecutor, options: AgentOptions);
    /**
     * Execute the reasoning loop
     */
    execute(): Promise<AgentResult>;
    /**
     * Call OpenRouter API via AiRepository
     */
    private callAPI;
    /**
     * Parse API response
     */
    private parseResponse;
}
