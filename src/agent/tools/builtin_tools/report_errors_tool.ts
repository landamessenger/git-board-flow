/**
 * Report Errors Tool
 * Tool for reporting detected errors in structured format
 */

import { BaseTool } from '../base_tool';
import { DetectedError } from '../../reasoning/error_detector/types';

export interface ReportErrorsToolOptions {
  onErrorsReported: (errors: DetectedError[]) => void;
}

export class ReportErrorsTool extends BaseTool {
  constructor(private options: ReportErrorsToolOptions) {
    super();
  }

  getName(): string {
    return 'report_errors';
  }

  getDescription(): string {
    return 'Report detected errors, bugs, vulnerabilities, or issues in a structured format. Use this tool to report all errors you found during your analysis. Each error should include file path, line number (if applicable), type, severity, description, and optional suggestion for fixing it.';
  }

  getInputSchema(): {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
    additionalProperties?: boolean;
  } {
    return {
      type: 'object',
      properties: {
        errors: {
          type: 'array',
          description: 'Array of detected errors, bugs, vulnerabilities, or issues. Each error must be a plain JSON object with clean string values (NO markdown, NO formatting, NO newlines in file/type fields).',
          items: {
            type: 'object',
            properties: {
              file: {
                type: 'string',
                description: 'File path where the error was found. MUST be a plain string path like "src/utils/logger.ts" or "docker/main.py". NO markdown formatting, NO "File:" prefix, NO newlines, NO bold/italic markers. Just the file path.'
              },
              line: {
                type: 'number',
                description: 'Line number where the error occurs (optional). MUST be a number, not a string. Only include if the error is specific to a line.'
              },
              type: {
                type: 'string',
                description: 'Type of error. MUST be a single plain string value like "bug", "security-issue", "logic-error", "performance-issue", "code-issue", "type-error", "runtime-error", "configuration-error", "code-quality". NO markdown, NO formatting, NO newlines, NO colons or prefixes. Just the type name.'
              },
              severity: {
                type: 'string',
                enum: ['critical', 'high', 'medium', 'low'],
                description: 'Severity level. MUST be exactly one of: "critical", "high", "medium", "low" (lowercase, no quotes in the value itself).'
              },
              description: {
                type: 'string',
                description: 'Detailed description of the error. Plain text description. Can contain newlines for readability, but NO markdown formatting (NO **, NO *, NO #, NO - prefixes). Just plain descriptive text explaining the issue.'
              },
              suggestion: {
                type: 'string',
                description: 'Optional suggestion for how to fix the issue. Plain text suggestion. Can contain newlines, but NO markdown formatting. Just plain text explaining how to fix it.'
              }
            },
            required: ['file', 'type', 'severity', 'description'],
            additionalProperties: false
          }
        }
      },
      required: ['errors'],
      additionalProperties: false
    };
  }

  async execute(input: Record<string, any>): Promise<string> {
    const { logInfo } = require('../../../utils/logger');
    const errors = input.errors as any[];

    if (!Array.isArray(errors)) {
      throw new Error('errors must be an array');
    }

    if (errors.length === 0) {
      logInfo('   ✅ No errors reported');
      this.options.onErrorsReported([]);
      return 'No errors to report. All files analyzed successfully.';
    }

    logInfo(`   📋 Reporting ${errors.length} error(s) in structured format`);

    // Clean and validate each error
    const cleanedErrors: DetectedError[] = [];
    for (let i = 0; i < errors.length; i++) {
      const error = errors[i];
      
      // Validate required fields exist
      if (!error || typeof error !== 'object') {
        throw new Error(`Error at index ${i}: must be an object`);
      }
      
      if (!error.file || !error.type || !error.severity || !error.description) {
        throw new Error(`Error at index ${i}: must have file, type, severity, and description fields`);
      }

      // Clean file path - remove markdown, prefixes, newlines
      let file = String(error.file)
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .replace(/^File:\s*/i, '')
        .replace(/^-\s*/, '')
        .replace(/\n/g, ' ')
        .replace(/\\n/g, ' ')
        .trim()
        .split('\n')[0]
        .split('\\n')[0];
      
      if (!file || file.length === 0) {
        throw new Error(`Error at index ${i}: file path is required and cannot be empty`);
      }

      // Clean type - remove markdown, prefixes, newlines
      let type = String(error.type)
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .replace(/^Type:\s*/i, '')
        .replace(/^-\s*/, '')
        .replace(/\n/g, ' ')
        .replace(/\\n/g, ' ')
        .trim()
        .split('\n')[0]
        .split('\\n')[0]
        .split(':')[0]
        .trim();
      
      if (!type || type.length === 0) {
        throw new Error(`Error at index ${i}: type is required and cannot be empty`);
      }

      // Validate and normalize severity
      let severity = String(error.severity).toLowerCase().trim();
      if (!['critical', 'high', 'medium', 'low'].includes(severity)) {
        throw new Error(`Error at index ${i}: Invalid severity "${error.severity}". Must be one of: critical, high, medium, low`);
      }

      // Clean description - remove markdown but preserve content
      let description = String(error.description)
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .replace(/^-\s*/, '')
        .replace(/^\d+\.\s*/, '')
        .replace(/\\n/g, '\n')
        .trim();
      
      // If description contains multiple errors concatenated, take only first
      const firstErrorMatch = description.match(/^([^]*?)(?:\n\s*[-*]\s*File:|$)/);
      if (firstErrorMatch) {
        description = firstErrorMatch[1].trim();
      }
      
      if (!description || description.length === 0) {
        throw new Error(`Error at index ${i}: description is required and cannot be empty`);
      }

      // Clean suggestion if provided
      let suggestion: string | undefined = undefined;
      if (error.suggestion) {
        suggestion = String(error.suggestion)
          .replace(/\*\*/g, '')
          .replace(/\*/g, '')
          .replace(/^-\s*/, '')
          .replace(/^\d+\.\s*/, '')
          .replace(/\\n/g, '\n')
          .trim();
        
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

      cleanedErrors.push({
        file,
        line,
        type,
        severity: severity as DetectedError['severity'],
        description,
        suggestion
      });
    }

    // Notify callback with cleaned errors
    this.options.onErrorsReported(cleanedErrors);

    return `Successfully reported ${cleanedErrors.length} error(s). Errors have been recorded for analysis.`;
  }
}

