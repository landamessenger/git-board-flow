/**
 * Error Detector
 * Uses Agent SDK to detect potential errors in the codebase
 */

import { Agent } from '../../core/agent';
import { AgentResult } from '../../types';
import { ErrorDetectionOptions, ErrorDetectionResult } from './types';
import { logInfo } from '../../../utils/logger';
import { AgentInitializer } from './agent_initializer';
import { ErrorParser } from './error_parser';
import { SummaryGenerator } from './summary_generator';
import { SubagentHandler } from './subagent_handler';

export class ErrorDetector {
  private agent!: Agent; // Will be initialized in initializeAgent
  private options: ErrorDetectionOptions;
  private repositoryFiles: Map<string, string> = new Map();

  constructor(options: ErrorDetectionOptions) {
    this.options = {
      model: options.model || process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
      apiKey: options.apiKey,
      maxTurns: options.maxTurns || 30,
      repositoryOwner: options.repositoryOwner,
      repositoryName: options.repositoryName,
      repositoryBranch: options.repositoryBranch,
      focusAreas: options.focusAreas || [],
      errorTypes: options.errorTypes || [],
      useSubAgents: options.useSubAgents !== undefined ? options.useSubAgents : false,
      maxConcurrentSubAgents: options.maxConcurrentSubAgents || 5,
      targetFile: options.targetFile,
      analyzeOnlyTargetFile: options.analyzeOnlyTargetFile || false,
      includeDependencies: options.includeDependencies || false
    };
  }

  /**
   * Detect errors in the codebase
   */
  async detectErrors(prompt?: string): Promise<ErrorDetectionResult> {
    logInfo('🔍 Starting error detection...');
    // Use minimal prompt if not provided - systemPrompt already has all instructions
    const userPrompt = prompt || 'Begin error detection analysis.';
    logInfo(`📋 User Prompt: ${userPrompt || '(using system prompt instructions only)'}`);
    logInfo(`📊 Configuration:`);
    logInfo(`   - Model: ${this.options.model}`);
    logInfo(`   - Max Turns: ${this.options.maxTurns}`);
    logInfo(`   - Repository: ${this.options.repositoryOwner}/${this.options.repositoryName || 'N/A'}`);
    logInfo(`   - Focus Areas: ${this.options.focusAreas?.join(', ') || 'All'}`);
    logInfo(`   - Error Types: ${this.options.errorTypes?.join(', ') || 'All'}`);
    logInfo(`   - Use Subagents: ${this.options.useSubAgents}`);
    if (this.options.useSubAgents) {
      logInfo(`   - Max Concurrent Subagents: ${this.options.maxConcurrentSubAgents}`);
    }
    if (this.options.targetFile) {
      logInfo(`   - Target File: ${this.options.targetFile}`);
      logInfo(`   - Analyze Only Target File: ${this.options.analyzeOnlyTargetFile || false}`);
      if (!this.options.analyzeOnlyTargetFile) {
        logInfo(`   - Include Dependencies: ${this.options.includeDependencies || false}`);
      }
    }

    // Initialize agent if not already initialized
    if (!this.agent) {
      logInfo('🤖 Initializing agent...');
      const { agent, repositoryFiles } = await AgentInitializer.initialize(this.options);
      this.agent = agent;
      this.repositoryFiles = repositoryFiles;
      logInfo('✅ Agent initialized');
    }

    let result: AgentResult;
    
    // Use subagents if enabled AND (files > 20 OR targetFile is specified)
    const shouldUseSubAgents = this.options.useSubAgents && 
      (this.repositoryFiles.size > 20 || this.options.targetFile !== undefined);
    
    if (shouldUseSubAgents) {
      logInfo('🚀 Executing error detection with subagents...');
      const subagentResult = await SubagentHandler.detectErrorsWithSubAgents(
        this.agent,
        this.repositoryFiles,
        this.options,
        userPrompt
      );
      result = subagentResult.agentResult;
    } else {
      // Execute agent query
      logInfo('🚀 Executing agent query...');
      result = await this.agent.query(userPrompt);
    }
    
    logInfo(`📈 Agent execution completed:`);
    logInfo(`   - Total Turns: ${result.turns.length}`);
    logInfo(`   - Tool Calls: ${result.toolCalls.length}`);
    if (result.metrics) {
      logInfo(`   - Input Tokens: ${result.metrics.totalTokens.input}`);
      logInfo(`   - Output Tokens: ${result.metrics.totalTokens.output}`);
      logInfo(`   - Total Duration: ${result.metrics.totalDuration}ms`);
      logInfo(`   - Average Latency: ${result.metrics.averageLatency}ms`);
    }

    // Parse errors from agent response and TODOs
    const errors = ErrorParser.parseErrors(result);

    // Generate summary
    const summary = SummaryGenerator.generateSummary(errors);

    logInfo(`✅ Error detection completed: ${summary.total} error(s) found`);

    return {
      errors,
      summary,
      agentResult: result
    };
  }

  /**
   * Get agent instance (for advanced usage)
   */
  getAgent(): Agent {
    return this.agent;
  }
}

