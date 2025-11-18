/**
 * Intent Parser
 * Parses intent classification from agent results
 * Only uses structured format from report_intent tool - no text parsing
 */

import { AgentResult } from '../../types';
import { IntentClassificationResult, ConfidenceLevel } from './types';
import { logDebugInfo, logWarn } from '../../../utils/logger';

export class IntentParser {
  /**
   * Parse intent classification from agent result
   * Only uses structured format from report_intent tool - no text parsing
   * The tool already validates and cleans the data, so we just extract it directly
   */
  static parseIntent(result: AgentResult): IntentClassificationResult {
    const defaultResult: IntentClassificationResult = {
      shouldApplyChanges: false,
      reasoning: 'Unable to determine intent from agent response.',
      confidence: ConfidenceLevel.LOW,
      agentResult: result,
    };

    logDebugInfo(`📝 Parsing intent classification from agent response (${result.toolCalls.length} tool calls)`);

    // Only parse intent from report_intent tool calls (structured format)
    // The tool already validated and cleaned the data, so we extract it directly
    for (const toolCall of result.toolCalls) {
      if (toolCall.name === 'report_intent' && toolCall.input.shouldApplyChanges !== undefined) {
        const shouldApplyChanges = Boolean(toolCall.input.shouldApplyChanges);
        
        const reasoning = toolCall.input.reasoning 
          ? String(toolCall.input.reasoning).trim() 
          : defaultResult.reasoning;

        const confidence = toolCall.input.confidence 
          ? String(toolCall.input.confidence).toLowerCase().trim() as ConfidenceLevel
          : defaultResult.confidence;

        // Validate confidence
        if (!Object.values(ConfidenceLevel).includes(confidence)) {
          logWarn(`   ⚠️ Invalid confidence value: ${confidence}, using default`);
          continue;
        }

        logDebugInfo(`   ✅ Found report_intent call with shouldApplyChanges: ${shouldApplyChanges}`);
        logDebugInfo(`   📝 Reasoning: ${reasoning.substring(0, 100)}...`);
        logDebugInfo(`   🎯 Confidence: ${confidence}`);

        return {
          shouldApplyChanges,
          reasoning,
          confidence,
          agentResult: result,
        } as IntentClassificationResult;
      }
    }

    logWarn('⚠️ No report_intent tool call found in agent result');
    logDebugInfo(`   📊 Final classification: shouldApplyChanges=${defaultResult.shouldApplyChanges}, confidence=${defaultResult.confidence}`);

    return defaultResult;
  }
}

