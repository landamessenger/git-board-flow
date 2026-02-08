/**
 * Intent Classifier Agent
 * Classifies user prompts to determine if changes should be applied to disk or kept in memory
 */

import { Agent } from '../../core/agent';
import { AgentResult } from '../../types';
import { IntentClassifierOptions, IntentClassificationResult, ConfidenceLevel } from './types';
import { logInfo, logError } from '../../../utils/logger';
import { AgentInitializer } from './agent_initializer';
import { IntentParser } from './intent_parser';

export class IntentClassifier {
  private agent!: Agent; // Will be initialized in classifyIntent
  private options: IntentClassifierOptions;

  constructor(options: IntentClassifierOptions) {
    this.options = {
      model: options.model || process.env.OPENCODE_MODEL || 'openai/gpt-4o-mini',
      serverUrl: options.serverUrl || process.env.OPENCODE_SERVER_URL || 'http://localhost:4096',
      maxTurns: options.maxTurns || 5
    };
  }

  /**
   * Classify user prompt to determine if changes should be applied
   * @param prompt - User prompt to classify
   * @returns IntentClassificationResult indicating if changes should be applied
   */
  async classifyIntent(prompt: string): Promise<IntentClassificationResult> {
    logInfo(`🔍 Classifying intent for prompt: "${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}"`);

    // Initialize agent if not already initialized
    if (!this.agent) {
      logInfo('🤖 Initializing agent...');
      const { agent } = await AgentInitializer.initialize(this.options);
      this.agent = agent;
      logInfo('✅ Agent initialized');
    }

    const classificationPrompt = `Analyze this user prompt and classify it:

"${prompt}"`;

    try {
      const agentResult: AgentResult = await this.agent.query(classificationPrompt);

      // Parse intent classification from agent result (extracts from report_intent tool call)
      const classification = IntentParser.parseIntent(agentResult);

      logInfo(`✅ Intent classified: shouldApplyChanges=${classification.shouldApplyChanges}, confidence=${classification.confidence}`);

      return {
        ...classification,
        agentResult
      };
    } catch (error: any) {
      logError(`❌ Error classifying intent: ${error.message}`);
      
      // Return fallback result with minimal agent result
      const fallbackClassification = this.fallbackClassification(prompt, '');
      return {
        ...fallbackClassification,
        agentResult: {
          finalResponse: '',
          turns: [],
          toolCalls: [],
          messages: []
        }
      };
    }
  }

  /**
   * Fallback classification using simple heuristics if agent fails
   * This is used when the parser cannot extract valid JSON from the response
   */
  private fallbackClassification(prompt: string, response: string): Omit<IntentClassificationResult, 'agentResult'> {
    const promptLower = prompt.toLowerCase();
    
    // Question indicators
    const questionIndicators = ['?', 'what', 'how', 'why', 'when', 'where', 'which', 'should', 'could', 'would', 'can you explain', 'tell me', 'describe', 'analyze'];
    const isQuestion = questionIndicators.some(indicator => promptLower.includes(indicator));
    
    // Order indicators
    const orderIndicators = ['create', 'write', 'make', 'build', 'set up', 'modify', 'add', 'implement', 'generate', 'do', 'ensure', 'verify', 'test', 'run', 'execute', 'delete', 'remove', 'eliminate'];
    const isOrder = orderIndicators.some(indicator => promptLower.includes(indicator));
    
    let shouldApply = false;
    let confidence: ConfidenceLevel = ConfidenceLevel.LOW;
    let reasoning = '';

    if (isQuestion && !isOrder) {
      shouldApply = false;
      confidence = ConfidenceLevel.HIGH;
      reasoning = 'Prompt contains question indicators';
    } else if (isOrder && !isQuestion) {
      shouldApply = true;
      confidence = ConfidenceLevel.HIGH;
      reasoning = 'Prompt contains order indicators';
    } else if (isOrder && isQuestion) {
      // Ambiguous - default to not applying (safer)
      shouldApply = false;
      confidence = ConfidenceLevel.MEDIUM;
      reasoning = 'Prompt contains both question and order indicators, defaulting to exploration mode';
    } else {
      // No clear indicators - default to not applying
      shouldApply = false;
      confidence = ConfidenceLevel.LOW;
      reasoning = 'No clear intent indicators found, defaulting to exploration mode';
    }

    return {
      shouldApplyChanges: shouldApply,
      reasoning,
      confidence
    };
  }
}

