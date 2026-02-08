/**
 * Agent Initializer
 * Initializes agent with tools for Intent Classifier
 */

import { Agent } from '../../core/agent';
import { AgentOptions } from '../../types';
import { IntentClassifierOptions, ConfidenceLevel } from './types';
import { ReportIntentTool } from '../../tools/builtin_tools/report_intent_tool';
import { logInfo } from '../../../utils/logger';
import { SystemPromptBuilder } from './system_prompt_builder';

export interface AgentInitializerResult {
  agent: Agent;
  reportedIntent?: {
    shouldApplyChanges: boolean;
    reasoning: string;
    confidence: ConfidenceLevel;
  };
}

export class AgentInitializer {
  /**
   * Initialize agent with tools
   */
  static async initialize(options: IntentClassifierOptions): Promise<AgentInitializerResult> {
    // Store for intent reported via report_intent tool
    let reportedIntent: {
      shouldApplyChanges: boolean;
      reasoning: string;
      confidence: ConfidenceLevel;
    } | undefined = undefined;

    const tools = await this.createTools((shouldApplyChanges, reasoning, confidence) => {
      reportedIntent = { shouldApplyChanges, reasoning, confidence };
    });
    
    const systemPrompt = SystemPromptBuilder.build();
    
    const agentOptions: AgentOptions = {
      model: options.model || process.env.OPENCODE_MODEL || 'openai/gpt-4o-mini',
      serverUrl: options.serverUrl || process.env.OPENCODE_SERVER_URL || 'http://localhost:4096',
      systemPrompt,
      tools,
      maxTurns: options.maxTurns || 5,
    };

    const agent = new Agent(agentOptions);

    return {
      agent,
      reportedIntent
    };
  }

  /**
   * Create tools for the agent
   */
  private static async createTools(
    onIntentReported: (shouldApplyChanges: boolean, reasoning: string, confidence: ConfidenceLevel) => void
  ) {
    const reportIntentTool = new ReportIntentTool({
      onIntentReported
    });

    return [reportIntentTool];
  }
}

