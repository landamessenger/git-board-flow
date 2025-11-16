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
          const error = this.extractErrorFromTodo(todoContent, toolCall.input);
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
  private static extractErrorFromTodo(todoContent: string, toolInput?: any): DetectedError | null {
    // First, check if file is explicitly provided in tool input
    let filePath = toolInput?.file || toolInput?.file_path || toolInput?.related_files?.[0];
    
    // Helper function to clean file path
    const cleanFilePath = (path: string): string => {
      return path.replace(/[:\s,;]+$/, '').trim(); // Remove trailing punctuation and whitespace
    };
    
    // If not found, try to extract from TODO content using multiple patterns
    if (!filePath) {
      // Pattern 1: "in src/path/to/file.ts:" or "in file.ts:"
      const inPattern = todoContent.match(/\bin\s+([^\s:]+\.(ts|js|tsx|jsx|py|java|go|rs|rb|php|cs|swift|kt|scala|clj|sh|bash|yaml|yml|json|xml|html|css|scss|less|vue|svelte|jsx|tsx))[:\s,]/i);
      if (inPattern) {
        filePath = cleanFilePath(inPattern[1]);
      }
    }
    
    if (!filePath) {
      // Pattern 2: Direct file path patterns (src/..., ./..., or absolute paths)
      const directPathPattern = todoContent.match(/\b(src\/|\.\/|\.\.\/|[\w\-]+\/)[^\s:,\n]+\.(ts|js|tsx|jsx|py|java|go|rs|rb|php|cs|swift|kt|scala|clj|sh|bash|yaml|yml|json|xml|html|css|scss|less|vue|svelte)[:\s,]/i);
      if (directPathPattern) {
        filePath = cleanFilePath(directPathPattern[0]);
      }
    }
    
    if (!filePath) {
      // Pattern 3: "file: path" or "file path" or "at path"
      const fileKeywordPattern = todoContent.match(/(?:file|archivo|at|en)\s*[:\s]+([^\s\n,]+\.(ts|js|tsx|jsx|py|java|go|rs|rb|php|cs|swift|kt|scala|clj|sh|bash|yaml|yml|json|xml|html|css|scss|less|vue|svelte))/i);
      if (fileKeywordPattern) {
        filePath = cleanFilePath(fileKeywordPattern[1]);
      }
    }
    
    if (!filePath) {
      // Pattern 4: Look for any path-like string that contains slashes and ends with common extensions
      const anyPathPattern = todoContent.match(/([^\s:,\n]+\/[^\s:,\n]+\.(ts|js|tsx|jsx|py|java|go|rs|rb|php|cs|swift|kt|scala|clj|sh|bash|yaml|yml|json|xml|html|css|scss|less|vue|svelte))[:\s,]/i);
      if (anyPathPattern) {
        filePath = cleanFilePath(anyPathPattern[1]);
      }
    }
    
    // Extract severity
    const severityMatch = todoContent.match(/\b(critical|high|medium|low|crítico|alto|medio|bajo)\b/i);
    
    // Extract type if available
    let errorType = 'code-issue';
    const typeMatch = todoContent.match(/\b(type|tipo)[:\s]+([^\s\n,]+)/i);
    if (typeMatch) {
      errorType = typeMatch[2];
    } else {
      // Try to infer type from description
      const lowerContent = todoContent.toLowerCase();
      if (lowerContent.includes('type error') || lowerContent.includes('type-error')) {
        errorType = 'type-error';
      } else if (lowerContent.includes('logic error') || lowerContent.includes('logic-error')) {
        errorType = 'logic-error';
      } else if (lowerContent.includes('security') || lowerContent.includes('security issue')) {
        errorType = 'security-issue';
      } else if (lowerContent.includes('performance') || lowerContent.includes('performance issue')) {
        errorType = 'performance-issue';
      } else if (lowerContent.includes('runtime error') || lowerContent.includes('runtime-error')) {
        errorType = 'runtime-error';
      }
    }
    
    return {
      file: filePath || 'unknown',
      type: errorType,
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

