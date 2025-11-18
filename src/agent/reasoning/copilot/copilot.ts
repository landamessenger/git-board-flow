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
      workingDirectory: options.workingDirectory || process.cwd(),
      useSubAgents: options.useSubAgents !== undefined ? options.useSubAgents : true, // Default to true
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
    logInfo(`   - Working Directory: ${this.options.workingDirectory || process.cwd()}`);

    // Initialize agent if not already initialized
    if (!this.agent) {
      logInfo('🤖 Initializing agent...');
      // Pass user prompt to options for context
      const optionsWithPrompt = { ...this.options, userPrompt: prompt };
      const { agent, repositoryFiles } = await AgentInitializer.initialize(optionsWithPrompt);
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
          const optionsWithPrompt = { ...this.options, userPrompt: prompt };
          result = await SubagentHandler.processPromptWithSubAgents(
            this.agent,
            this.repositoryFiles,
            optionsWithPrompt,
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
    if (result.agentResult) {
      logInfo(`   - Total Turns: ${result.agentResult.turns.length}`);
      logInfo(`   - Tool Calls: ${result.agentResult.toolCalls.length}`);
      if (result.agentResult.metrics) {
        logInfo(`   - Input Tokens: ${result.agentResult.metrics.totalTokens.input}`);
        logInfo(`   - Output Tokens: ${result.agentResult.metrics.totalTokens.output}`);
        logInfo(`   - Total Duration: ${result.agentResult.metrics.totalDuration}ms`);
        logInfo(`   - Average Latency: ${result.agentResult.metrics.averageLatency}ms`);
      }
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
   * This method parses the agent's tool calls and results to identify any code changes
   * that were proposed using the propose_change tool.
   * 
   * @param result - Agent result containing tool calls and results
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

    // Create a map of toolCallId -> toolResult for quick lookup
    const toolResultMap = new Map<string, any>();
    for (const turn of result.turns) {
      if (turn.toolResults) {
        for (const toolResult of turn.toolResults) {
          toolResultMap.set(toolResult.toolCallId, toolResult);
        }
      }
    }

    // Look for apply_changes tool calls (these are the ones actually written to disk)
    // Also check propose_change for proposed changes (in memory)
    for (const toolCall of result.toolCalls) {
      if (toolCall.name === 'apply_changes') {
        const toolResult = toolResultMap.get(toolCall.id);
        if (toolResult && !toolResult.isError) {
          try {
            // Extract applied changes from the result
            // The result contains information about which files were applied
            const resultContent = toolResult.content || '';
            
            // Parse the result to extract file paths
            // Format: "Applied N file(s) to disk:\n  - file1 (create)\n  - file2 (modify)"
            const lines = resultContent.split('\n');
            for (const line of lines) {
              const match = line.match(/^\s*-\s*(.+?)\s*\((\w+)\)/);
              if (match) {
                changes.push({
                  file: match[1].trim(),
                  changeType: match[2] as 'create' | 'modify' | 'delete' | 'refactor',
                  description: `Applied ${match[2]}`
                });
              }
            }
          } catch (error) {
            // Ignore parsing errors
          }
        }
      } else if (toolCall.name === 'propose_change') {
        // Also track proposed changes (even if not yet applied)
        const toolResult = toolResultMap.get(toolCall.id);
        if (toolResult && !toolResult.isError) {
          try {
            const changeData = toolCall.input;
            if (changeData && changeData.file_path) {
              // Mark as proposed (not yet applied)
              changes.push({
                file: changeData.file_path,
                changeType: changeData.change_type || 'modify',
                description: `Proposed: ${changeData.description || 'no description'}`
              });
            }
          } catch (error) {
            // Ignore parsing errors
          }
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

