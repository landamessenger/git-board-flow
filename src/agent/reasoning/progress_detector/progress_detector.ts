/**
 * Progress Detector
 * Uses Agent SDK to detect progress of a task based on code changes
 */

import { Agent } from '../../core/agent';
import { AgentResult } from '../../types';
import { ProgressDetectionOptions, ProgressDetectionResult } from './types';
import { logInfo } from '../../../utils/logger';
import { AgentInitializer } from './agent_initializer';
import { ProgressParser } from './progress_parser';

export class ProgressDetector {
  private agent!: Agent; // Will be initialized in initializeAgent
  private options: ProgressDetectionOptions;
  private repositoryFiles: Map<string, string> = new Map();

  constructor(options: ProgressDetectionOptions) {
    this.options = {
      model: options.model || process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
      apiKey: options.apiKey,
      personalAccessToken: options.personalAccessToken,
      maxTurns: options.maxTurns || 20,
      repositoryOwner: options.repositoryOwner,
      repositoryName: options.repositoryName,
      repositoryBranch: options.repositoryBranch,
      developmentBranch: options.developmentBranch || 'develop',
      issueNumber: options.issueNumber,
      issueDescription: options.issueDescription,
      changedFiles: options.changedFiles || []
    };
  }

  /**
   * Detect progress of the task
   */
  async detectProgress(prompt?: string): Promise<ProgressDetectionResult> {
    logInfo('📊 Starting progress detection...');
    const userPrompt = prompt || `Analyze the progress of issue #${this.options.issueNumber || 'the task'} based on the changes made.`;
    logInfo(`📋 User Prompt: ${userPrompt}`);
    logInfo(`📊 Configuration:`);
    logInfo(`   - Model: ${this.options.model}`);
    logInfo(`   - Max Turns: ${this.options.maxTurns}`);
    logInfo(`   - Repository: ${this.options.repositoryOwner}/${this.options.repositoryName || 'N/A'}`);
    logInfo(`   - Branch: ${this.options.repositoryBranch || 'N/A'}`);
    logInfo(`   - Issue: #${this.options.issueNumber || 'N/A'}`);
    logInfo(`   - Changed Files: ${this.options.changedFiles?.length || 0}`);

    // Initialize agent if not already initialized
    if (!this.agent) {
      logInfo('🤖 Initializing agent...');
      const { agent, repositoryFiles, reportedProgress } = await AgentInitializer.initialize(this.options);
      this.agent = agent;
      this.repositoryFiles = repositoryFiles;
      logInfo('✅ Agent initialized');
      
      // If progress was already reported during initialization (shouldn't happen, but handle it)
      if (reportedProgress) {
        logInfo(`📊 Progress already reported during initialization: ${reportedProgress.progress}%`);
      }
    }

    // Execute agent query
    logInfo('🚀 Executing agent query...');
    const result: AgentResult = await this.agent.query(userPrompt);
    
    logInfo(`📈 Agent execution completed:`);
    logInfo(`   - Total Turns: ${result.turns.length}`);
    logInfo(`   - Tool Calls: ${result.toolCalls.length}`);
    if (result.metrics) {
      logInfo(`   - Input Tokens: ${result.metrics.totalTokens.input}`);
      logInfo(`   - Output Tokens: ${result.metrics.totalTokens.output}`);
      logInfo(`   - Total Duration: ${result.metrics.totalDuration}ms`);
      logInfo(`   - Average Latency: ${result.metrics.averageLatency}ms`);
    }

    // Parse progress from agent response
    const { progress, summary } = ProgressParser.parseProgress(result);

    logInfo(`✅ Progress detection completed: ${progress}%`);

    return {
      progress,
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

