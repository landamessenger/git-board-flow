/**
 * Error Parser
 * Parses errors from agent results and tool calls
 */

import { AgentResult } from '../../types';
import { DetectedError, IssueType } from './types';
import { logDebugInfo } from '../../../utils/logger';

export class ErrorParser {
  /**
   * Parse errors from agent result
   * Only uses structured format from report_errors tool - no text parsing
   * The tool already validates and cleans the data, so we just extract it directly
   */
  static parseErrors(result: AgentResult): DetectedError[] {
    const errors: DetectedError[] = [];
    
    logDebugInfo(`📝 Parsing ${result.toolCalls.length} tool calls from agent`);

    // Only parse errors from report_errors tool calls (structured format)
    // The tool already validated and cleaned the data, so we extract it directly
    for (const toolCall of result.toolCalls) {
      if (toolCall.name === 'report_errors' && toolCall.input.errors) {
        const reportedErrors = toolCall.input.errors as any[];
        const errorCount = Array.isArray(reportedErrors) ? reportedErrors.length : 0;
        logDebugInfo(`   Found report_errors call with ${errorCount} error(s)`);
        
        if (Array.isArray(reportedErrors)) {
          // Tool already validated and cleaned, so we can use the data directly
          // Just ensure each error has the required structure
          for (let i = 0; i < reportedErrors.length; i++) {
            const err = reportedErrors[i];
            if (err && typeof err === 'object' && err.file && err.type && err.severity && err.description) {
              // Validate and convert type to IssueType enum
              let issueType: IssueType;
              const typeStr = String(err.type).trim().toLowerCase();
              if (Object.values(IssueType).includes(typeStr as IssueType)) {
                issueType = typeStr as IssueType;
              } else {
                // Try to find a close match
                const validTypes = Object.values(IssueType);
                const closeMatch = validTypes.find(t => t.includes(typeStr) || typeStr.includes(t));
                issueType = closeMatch || IssueType.CODE_ISSUE;
                if (!closeMatch) {
                  logDebugInfo(`   ⚠️ Error at index ${i}: invalid type "${typeStr}", using fallback "${issueType}"`);
                }
              }
              
              errors.push({
                file: String(err.file).trim(),
                line: typeof err.line === 'number' ? err.line : (err.line ? parseInt(String(err.line), 10) : undefined),
                type: issueType,
                severity: String(err.severity).toLowerCase().trim() as DetectedError['severity'],
                description: String(err.description).trim(),
                suggestion: err.suggestion ? String(err.suggestion).trim() : undefined
              });
            } else {
              logDebugInfo(`   ⚠️ Error at index ${i} missing required fields, skipping`);
            }
          }
        }
      }
    }
    
    logDebugInfo(`   ✅ Extracted ${errors.length} error(s) from report_errors tool calls`);

    return errors;
  }

}


