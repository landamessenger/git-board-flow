/**
 * Copilot Agent
 * Uses Agent SDK to provide advanced reasoning and code-manipulation capabilities
 *
 * Copilot can analyze, explain, answer questions about, and modify source code
 * based on user-defined prompts or automated workflows.
 *
 * Its purpose is to act as an on-demand development assistant capable of offering
 * guidance, insights, and direct code transformations across the repository.
 */
import { Agent } from '../../core/agent';
import { CopilotOptions, CopilotResult } from './types';
export declare class Copilot {
    private agent;
    private options;
    private repositoryFiles;
    constructor(options: CopilotOptions);
    /**
     * Process a user prompt and provide a response
     *
     * This method handles various types of requests:
     * - Questions about code structure, functionality, or implementation
     * - Requests to analyze code for issues or patterns
     * - Requests to explain how code works
     * - Requests to modify existing code
     * - Requests to create new files or implement features
     *
     * @param prompt - User's prompt/question/request
     * @returns CopilotResult containing the agent's response and any changes made
     */
    processPrompt(prompt: string): Promise<CopilotResult>;
    /**
     * Determine if a prompt is complex enough to benefit from sub-agents
     *
     * @internal
     * Complex prompts typically involve:
     * - Analyzing multiple files
     * - Refactoring across the codebase
     * - Large-scale changes
     * - Comprehensive analysis tasks
     *
     * @param prompt - User's prompt
     * @returns true if the prompt seems complex
     */
    private isComplexPrompt;
    /**
     * Extract changes from agent result
     *
     * @internal
     * This method parses the agent's tool calls and results to identify any code changes
     * that were proposed using the propose_change tool.
     *
     * @param result - Agent result containing tool calls and results
     * @returns Array of changes made
     */
    private extractChanges;
    /**
     * Get agent instance (for advanced usage)
     */
    getAgent(): Agent;
}
