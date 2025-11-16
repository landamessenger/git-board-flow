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
   * Only uses structured format from report_errors tool - no text parsing
   */
  static parseErrors(result: AgentResult): DetectedError[] {
    const errors: DetectedError[] = [];
    
    logDebugInfo(`📝 Parsing ${result.toolCalls.length} tool calls from agent`);

    // Only parse errors from report_errors tool calls (structured format)
    for (const toolCall of result.toolCalls) {
      if (toolCall.name === 'report_errors' && toolCall.input.errors) {
        logDebugInfo(`   Found report_errors call with ${Array.isArray(toolCall.input.errors) ? toolCall.input.errors.length : 0} error(s)`);
        const reportedErrors = toolCall.input.errors as any[];
        if (Array.isArray(reportedErrors)) {
          // Clean and normalize each error (handles any edge cases from AI)
          const cleanedErrors = reportedErrors.map(err => this.cleanError(err)).filter(err => err !== null) as DetectedError[];
          errors.push(...cleanedErrors);
        }
      }
    }

    // Deduplicate errors based on file + line + type
    return this.deduplicateErrors(errors);
  }

  /**
   * Deduplicate errors based on file, line, and type
   */
  private static deduplicateErrors(errors: DetectedError[]): DetectedError[] {
    const seen = new Set<string>();
    const unique: DetectedError[] = [];

    for (const error of errors) {
      // Create a unique key: file + line + type
      const key = `${error.file}:${error.line || 'no-line'}:${error.type}`;
      
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(error);
      } else {
        logDebugInfo(`   Skipping duplicate error: ${key}`);
      }
    }

    return unique;
  }


  /**
   * Clean and normalize error data from report_errors tool
   */
  private static cleanError(error: any): DetectedError | null {
    if (!error || typeof error !== 'object') {
      return null;
    }

    // Clean file path - remove markdown, newlines, and extra whitespace
    let file = error.file;
    if (typeof file === 'string') {
      file = file
        .replace(/\*\*/g, '') // Remove markdown bold
        .replace(/\n/g, ' ') // Replace newlines with spaces
        .replace(/\\n/g, ' ') // Replace escaped newlines
        .trim()
        .split('\n')[0] // Take only first line if multiple
        .split('\\n')[0]; // Take only first part if escaped
      
      // Remove common prefixes/suffixes
      file = file.replace(/^File:\s*/i, '').replace(/^-\s*/, '').trim();
    } else {
      return null; // File is required
    }

    if (!file || file.length === 0) {
      return null;
    }

    // Clean type - remove markdown and newlines
    let type = error.type;
    if (typeof type === 'string') {
      type = type
        .replace(/\*\*/g, '')
        .replace(/\n/g, ' ')
        .replace(/\\n/g, ' ')
        .trim()
        .split('\n')[0]
        .split('\\n')[0]
        .split(':')[0] // Remove anything after colon
        .trim();
    } else {
      type = 'code-issue'; // Default
    }

    // Clean description - remove markdown but preserve content
    let description = error.description;
    if (typeof description === 'string') {
      description = description
        .replace(/\*\*/g, '') // Remove markdown bold
        .replace(/\*/g, '') // Remove markdown italic
        .replace(/\\n/g, '\n') // Convert escaped newlines to real newlines
        .replace(/\n{3,}/g, '\n\n') // Limit consecutive newlines
        .trim();
      
      // Remove common markdown patterns
      description = description
        .replace(/^-\s*/, '')
        .replace(/^\d+\.\s*/, '')
        .trim();
      
      // If description contains multiple errors (separated by patterns), take only the first relevant part
      const firstErrorMatch = description.match(/^([^]*?)(?:\n\s*[-*]\s*File:|$)/);
      if (firstErrorMatch) {
        description = firstErrorMatch[1].trim();
      }
    } else {
      description = 'Error detected';
    }

    // Clean suggestion - similar to description
    let suggestion = error.suggestion;
    if (suggestion && typeof suggestion === 'string') {
      suggestion = suggestion
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .replace(/\\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
        .replace(/^-\s*/, '')
        .replace(/^\d+\.\s*/, '')
        .trim();
      
      // Take only first suggestion if multiple
      const firstSuggestionMatch = suggestion.match(/^([^]*?)(?:\n\s*[-*]\s*File:|$)/);
      if (firstSuggestionMatch) {
        suggestion = firstSuggestionMatch[1].trim();
      }
    }

    // Parse line number
    let line: number | undefined = undefined;
    if (error.line !== undefined && error.line !== null) {
      if (typeof error.line === 'number') {
        line = error.line;
      } else if (typeof error.line === 'string') {
        const lineMatch = error.line.match(/(\d+)/);
        if (lineMatch) {
          line = parseInt(lineMatch[1], 10);
        }
      }
    }

    // Validate severity
    let severity = error.severity;
    if (typeof severity === 'string') {
      severity = severity.toLowerCase().trim();
      if (!['critical', 'high', 'medium', 'low'].includes(severity)) {
        severity = 'medium'; // Default
      }
    } else {
      severity = 'medium';
    }

    return {
      file,
      line,
      type,
      severity: severity as DetectedError['severity'],
      description,
      suggestion
    };
  }
}

