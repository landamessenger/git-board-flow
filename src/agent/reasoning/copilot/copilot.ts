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
import { AgentResult } from '../../types';
import { CopilotOptions, CopilotResult } from './types';
import { logInfo, logWarn } from '../../../utils/logger';
import { AgentInitializer } from './agent_initializer';
import { SubagentHandler } from './subagent_handler';

export class Copilot {
  private agent!: Agent; // Will be initialized in initializeAgent
  private options: CopilotOptions;
  private repositoryFiles: Map<string, string> = new Map();

  constructor(options: CopilotOptions) {
    this.options = {
      model: options.model || process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
      apiKey: options.apiKey,
      personalAccessToken: options.personalAccessToken,
      maxTurns: options.maxTurns || 50,
      repositoryOwner: options.repositoryOwner,
      repositoryName: options.repositoryName,
      repositoryBranch: options.repositoryBranch,
      workingDirectory: options.workingDirectory || 'copilot_dummy',
      useSubAgents: options.useSubAgents !== undefined ? options.useSubAgents : false,
      maxConcurrentSubAgents: options.maxConcurrentSubAgents || 5
    };
  }

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
  async processPrompt(prompt: string): Promise<CopilotResult> {
    logInfo('🤖 Starting Copilot agent...');
    logInfo(`📋 User Prompt: ${prompt}`);
    logInfo(`📊 Configuration:`);
    logInfo(`   - Model: ${this.options.model}`);
    logInfo(`   - Max Turns: ${this.options.maxTurns}`);
    logInfo(`   - Repository: ${this.options.repositoryOwner}/${this.options.repositoryName || 'N/A'}`);
    logInfo(`   - Branch: ${this.options.repositoryBranch || 'N/A'}`);
    logInfo(`   - Working Directory: ${this.options.workingDirectory || 'copilot_dummy'}`);

    // Initialize agent if not already initialized
    if (!this.agent) {
      logInfo('🤖 Initializing agent...');
      const { agent, repositoryFiles } = await AgentInitializer.initialize(this.options);
      this.agent = agent;
      this.repositoryFiles = repositoryFiles;
      logInfo('✅ Agent initialized');
    }

    let result: CopilotResult;
    
    // Use subagents if enabled AND (files > 20 OR prompt seems complex)
    // Complex prompts are those that mention multiple files, analysis, refactoring, etc.
    const isComplexPrompt = this.isComplexPrompt(prompt);
    const shouldUseSubAgents = this.options.useSubAgents && 
      (this.repositoryFiles.size > 20 || isComplexPrompt);
    
    if (shouldUseSubAgents) {
      logInfo('🚀 Executing copilot task with subagents...');
      result = await SubagentHandler.processPromptWithSubAgents(
        this.agent,
        this.repositoryFiles,
        this.options,
        prompt
      );
    } else {
      // Warn if many files but sub-agents are disabled
      if (!this.options.useSubAgents && this.repositoryFiles.size > 20) {
        logWarn(`⚠️  Many files detected (${this.repositoryFiles.size}) but sub-agents are disabled. This may be slow or hit token limits. Consider enabling sub-agents for better performance.`);
      }
      
      // Execute agent query
      logInfo('🚀 Executing agent query...');
      const agentResult: AgentResult = await this.agent.query(prompt);
      
      // Extract changes from tool calls
      const changes = this.extractChanges(agentResult);
      
      result = {
        response: agentResult.finalResponse || 'No response generated',
        agentResult: agentResult,
        changes: changes.length > 0 ? changes : undefined
      };
    }
    
    logInfo(`📈 Agent execution completed:`);
    logInfo(`   - Total Turns: ${result.agentResult.turns.length}`);
    logInfo(`   - Tool Calls: ${result.agentResult.toolCalls.length}`);
    if (result.agentResult.metrics) {
      logInfo(`   - Input Tokens: ${result.agentResult.metrics.totalTokens.input}`);
      logInfo(`   - Output Tokens: ${result.agentResult.metrics.totalTokens.output}`);
      logInfo(`   - Total Duration: ${result.agentResult.metrics.totalDuration}ms`);
      logInfo(`   - Average Latency: ${result.agentResult.metrics.averageLatency}ms`);
    }
    if (result.changes && result.changes.length > 0) {
      logInfo(`   - Changes Made: ${result.changes.length}`);
    }

    logInfo(`✅ Copilot processing completed`);

    return result;
  }

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
  private isComplexPrompt(prompt: string): boolean {
    const promptLower = prompt.toLowerCase();
    const complexKeywords = [
      'all files',
      'entire codebase',
      'all code',
      'refactor',
      'refactoring',
      'analyze all',
      'review all',
      'check all',
      'multiple files',
      'across the',
      'throughout',
      'comprehensive',
      'complete analysis',
      'full analysis'
    ];
    
    return complexKeywords.some(keyword => promptLower.includes(keyword));
  }

  /**
   * Extract changes from agent result
   * 
   * @internal
   * This method parses the agent's tool calls to identify any code changes
   * that were proposed using the propose_change tool.
   * 
   * @param result - Agent result containing tool calls
   * @returns Array of changes made
   */
  private extractChanges(result: AgentResult): Array<{
    file: string;
    changeType: 'create' | 'modify' | 'delete' | 'refactor';
    description?: string;
  }> {
    const changes: Array<{
      file: string;
      changeType: 'create' | 'modify' | 'delete' | 'refactor';
      description?: string;
    }> = [];

    for (const toolCall of result.toolCalls) {
      if (toolCall.toolName === 'propose_change' && toolCall.result) {
        try {
          const changeData = typeof toolCall.result === 'string' 
            ? JSON.parse(toolCall.result) 
            : toolCall.result;
          
          if (changeData && changeData.file_path) {
            changes.push({
              file: changeData.file_path,
              changeType: changeData.change_type || 'modify',
              description: changeData.description
            });
          }
        } catch (error) {
          // Ignore parsing errors
        }
      }
    }

    return changes;
  }

  /**
   * Get agent instance (for advanced usage)
   */
  getAgent(): Agent {
    return this.agent;
  }
}

