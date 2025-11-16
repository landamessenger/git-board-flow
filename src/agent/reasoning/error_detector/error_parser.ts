/**
 * Error Parser
 * Parses errors from agent results and tool calls
 */

import { AgentResult } from '../../types';
import { DetectedError } from './types';
import { logDebugInfo } from '../../../utils/logger';

export class ErrorParser {
  /**
   * Parse errors from agent result
   */
  static parseErrors(result: AgentResult): DetectedError[] {
    const errors: DetectedError[] = [];
    
    logDebugInfo(`📝 Parsing ${result.messages.length} messages from agent`);
    logDebugInfo(`📝 Parsing ${result.toolCalls.length} tool calls from agent`);
    logDebugInfo(`📝 Parsing ${result.turns.length} turns from agent`);

    // Parse errors from agent messages
    for (const message of result.messages) {
      if (message.role === 'assistant') {
        logDebugInfo(`   Analyzing assistant message (${typeof message.content === 'string' ? message.content.length : 'object'} chars)`);
      }
      if (message.role === 'assistant') {
        const content = typeof message.content === 'string' 
          ? message.content 
          : JSON.stringify(message.content);

        // Look for error patterns in the response
        const errorMatches = this.extractErrorsFromText(content);
        errors.push(...errorMatches);
      }
    }

    // Parse errors from tool calls (manage_todos might have created error TODOs)
    logDebugInfo(`🔍 Analyzing ${result.toolCalls.length} tool calls for error indicators`);
    for (const toolCall of result.toolCalls) {
      if (toolCall.name === 'manage_todos' && toolCall.input.action === 'create') {
        logDebugInfo(`   Found TODO creation: ${toolCall.input.content?.substring(0, 100) || 'N/A'}`);
        // TODOs created might represent errors found
        const todoContent = toolCall.input.content || toolCall.input.description || toolCall.input.text || '';
        if (this.isErrorRelatedTodo(todoContent)) {
          const error = this.extractErrorFromTodo(todoContent);
          if (error) {
            errors.push(error);
          }
        }
      }
    }

    // Also check tool results for proposed changes (these might indicate errors)
    for (const turn of result.turns) {
      if (turn.toolResults) {
        for (const toolResult of turn.toolResults) {
          if (toolResult.content && typeof toolResult.content === 'string') {
            const content = toolResult.content;
            
            // Check if it's a propose_change result (indicates an error was found)
            if (this.isProposedChangeResult(content)) {
              // Try to extract error info from the change description
              const changeErrors = this.extractErrorsFromChangeDescription(content);
              errors.push(...changeErrors);
            }
          }
        }
      }
    }

    return errors;
  }

  /**
   * Extract errors from text response
   */
  private static extractErrorsFromText(text: string): DetectedError[] {
    const errors: DetectedError[] = [];
    
    // Pattern to match error descriptions
    const errorPatterns = [
      /File:\s*(.+?)\n.*?Line:\s*(\d+)?.*?Type:\s*(.+?)\n.*?Severity:\s*(critical|high|medium|low).*?Description:\s*(.+?)(?:\n.*?Suggestion:\s*(.+?))?(?=\n\n|$)/gis,
      /- (.+?)\s+\((.+?):(\d+)?\)\s+\[(critical|high|medium|low)\]:\s*(.+?)(?:\n\s*Fix:\s*(.+?))?(?=\n|$)/gis
    ];

    for (const pattern of errorPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        errors.push({
          file: match[1] || match[2] || 'unknown',
          line: match[2] || match[3] ? parseInt(match[2] || match[3]) : undefined,
          type: match[3] || match[4] || 'unknown',
          severity: (match[4] || match[5] || 'medium') as DetectedError['severity'],
          description: match[5] || match[6] || 'Error detected',
          suggestion: match[6] || match[7]
        });
      }
    }

    return errors;
  }

  /**
   * Extract errors from change description
   */
  private static extractErrorsFromChangeDescription(text: string): DetectedError[] {
    const errors: DetectedError[] = [];
    
    // Try to extract file path and error info
    const fileMatch = text.match(/file[:\s]+([^\s\n]+)/i);
    const severityMatch = text.match(/(critical|high|medium|low)/i);
    
    if (fileMatch) {
      errors.push({
        file: fileMatch[1],
        type: 'code-issue',
        severity: (severityMatch?.[1]?.toLowerCase() || 'medium') as DetectedError['severity'],
        description: text.substring(0, 200) // First 200 chars as description
      });
    }

    return errors;
  }

  /**
   * Check if TODO content is error-related
   */
  private static isErrorRelatedTodo(todoContent: string): boolean {
    const lowerContent = todoContent.toLowerCase();
    return lowerContent.includes('error') || 
           lowerContent.includes('bug') ||
           lowerContent.includes('issue') ||
           lowerContent.includes('problem') ||
           lowerContent.includes('fix') ||
           lowerContent.includes('corregir');
  }

  /**
   * Extract error from TODO content
   */
  private static extractErrorFromTodo(todoContent: string): DetectedError | null {
    // Try to extract file info from TODO content
    const fileMatch = todoContent.match(/(?:file|archivo|en|at)\s*[:\s]+([^\s\n,]+)/i);
    const severityMatch = todoContent.match(/(critical|high|medium|low|crítico|alto|medio|bajo)/i);
    
    return {
      file: fileMatch ? fileMatch[1] : 'unknown',
      type: 'code-issue',
      severity: (severityMatch?.[1]?.toLowerCase() || 'medium') as DetectedError['severity'],
      description: todoContent
    };
  }

  /**
   * Check if content indicates a proposed change result
   */
  private static isProposedChangeResult(content: string): boolean {
    return content.includes('proposed change') || 
           content.includes('suggested fix') || 
           content.includes('Change applied');
  }
}

