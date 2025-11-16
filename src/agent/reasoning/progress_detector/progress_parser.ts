/**
 * Progress Parser
 * Parses progress percentage from agent results
 * Only uses structured format from report_progress tool - no text parsing
 */

import { AgentResult } from '../../types';
import { logDebugInfo, logWarn } from '../../../utils/logger';

export class ProgressParser {
  /**
   * Parse progress from agent result
   * Only uses structured format from report_progress tool - no text parsing
   * The tool already validates and cleans the data, so we just extract it directly
   */
  static parseProgress(result: AgentResult): { progress: number; summary: string } {
    const defaultProgress = 0;
    const defaultSummary = 'Unable to determine progress from agent response.';
    
    logDebugInfo(`📝 Parsing progress from agent response (${result.toolCalls.length} tool calls)`);

    // Only parse progress from report_progress tool calls (structured format)
    // The tool already validated and cleaned the data, so we extract it directly
    for (const toolCall of result.toolCalls) {
      if (toolCall.name === 'report_progress' && toolCall.input.progress !== undefined) {
        const progress = typeof toolCall.input.progress === 'number' 
          ? toolCall.input.progress 
          : parseFloat(String(toolCall.input.progress));
        
        const summary = toolCall.input.summary 
          ? String(toolCall.input.summary).trim() 
          : defaultSummary;

        // Validate progress range
        if (!isNaN(progress) && progress >= 0 && progress <= 100) {
          const roundedProgress = Math.round(progress);
          logDebugInfo(`   ✅ Found report_progress call with progress: ${roundedProgress}%`);
          logDebugInfo(`   📝 Summary: ${summary.substring(0, 100)}...`);
          
          return { 
            progress: roundedProgress, 
            summary: summary || defaultSummary 
          };
        } else {
          logWarn(`   ⚠️ Invalid progress value: ${progress}, must be between 0 and 100`);
        }
      }
    }
    
    logWarn('⚠️ No report_progress tool call found in agent result');
    logDebugInfo(`   📊 Final progress: ${defaultProgress}%`);
    logDebugInfo(`   📝 Summary: ${defaultSummary}`);

    return { progress: defaultProgress, summary: defaultSummary };
  }
}

