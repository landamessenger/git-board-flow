/**
 * Report Errors Tool - Tool for reporting detected errors in structured format.
 * 
 * This tool allows agents to report detected errors, bugs, vulnerabilities, or issues in a
 * structured format. Each error includes file path, line number (if applicable), type, severity,
 * description, and optional suggestion for fixing it.
 * 
 * @internal
 * This tool is used by the ErrorDetector agent to report all errors found during code analysis.
 * The tool validates and cleans error data to ensure consistency, removing markdown formatting
 * and normalizing values according to IssueType and SeverityLevel enums.
 * 
 * @remarks
 * - Errors must be provided as an array of plain JSON objects
 * - File paths and types are cleaned to remove markdown formatting
 * - IssueType values are validated and normalized (fallback to CODE_ISSUE if invalid)
 * - SeverityLevel values must be one of: critical, high, medium, low
 * - Descriptions and suggestions can contain newlines but no markdown formatting
 * - Line numbers are optional and parsed from strings if needed
 * 
 * @example
 * ```typescript
 * const tool = new ReportErrorsTool({
 *   onErrorsReported: (errors) => { console.log('Errors reported:', errors); }
 * });
 * 
 * await tool.execute({
 *   errors: [
 *     {
 *       file: 'src/utils.ts',
 *       line: 42,
 *       type: 'bug',
 *       severity: 'high',
 *       description: 'Null pointer exception possible',
 *       suggestion: 'Add null check before accessing property'
 *     }
 *   ]
 * });
 * ```
 */

import { BaseTool } from '../base_tool';
import { DetectedError, IssueType, SeverityLevel } from '../../reasoning/error_detector/types';

/**
 * Options for configuring the ReportErrorsTool.
 * 
 * @internal
 * The callback connects the tool to the error reporting system, allowing errors to be
 * processed and stored after validation and cleaning.
 * 
 * @property onErrorsReported - Callback invoked with cleaned and validated errors array.
 */
export interface ReportErrorsToolOptions {
  /**
   * Callback invoked when errors are reported.
   * 
   * @internal
   * This callback receives the cleaned and validated errors array. Errors have been
   * normalized, markdown removed, and validated against IssueType and SeverityLevel enums.
   * 
   * @param errors - Array of cleaned and validated DetectedError objects
   */
  onErrorsReported: (errors: DetectedError[]) => void;
}

/**
 * ReportErrorsTool - Tool for reporting detected errors in structured format.
 * 
 * This tool provides a structured interface for agents to report errors found during code
 * analysis. It validates, cleans, and normalizes error data before passing it to the callback.
 * 
 * @internal
 * The tool performs extensive cleaning and validation:
 * - Removes markdown formatting from file paths, types, descriptions, and suggestions
 * - Validates IssueType values (with fallback to CODE_ISSUE if invalid)
 * - Validates SeverityLevel values (must be one of: critical, high, medium, low)
 * - Parses line numbers from strings if needed
 * - Extracts first error from concatenated error descriptions
 */
export class ReportErrorsTool extends BaseTool {
  /**
   * Creates a new ReportErrorsTool instance.
   * 
   * @internal
   * The options parameter provides the callback that receives cleaned and validated errors.
   * 
   * @param options - Configuration object with callback for error reporting
   */
  constructor(private options: ReportErrorsToolOptions) {
    super();
  }

  /**
   * Returns the tool name used by the agent system.
   * 
   * @internal
   * This name is used when the agent calls the tool via tool calls.
   * 
   * @returns Tool identifier: 'report_errors'
   */
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
                enum: Object.values(IssueType),
                description: `Type of error. MUST be one of the standard issue types: ${Object.values(IssueType).slice(0, 10).join(', ')}, ... (see IssueType enum for complete list). NO markdown, NO formatting, NO newlines, NO colons or prefixes. Just the type name.`
              },
              severity: {
                type: 'string',
                enum: Object.values(SeverityLevel),
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

  /**
   * Executes the tool with the provided input.
   * 
   * This method processes an array of errors, validates and cleans each error, and then
   * passes the cleaned errors to the callback. The cleaning process removes markdown
   * formatting, normalizes values, and validates against IssueType and SeverityLevel enums.
   * 
   * @internal
   * The method performs extensive validation and cleaning:
   * 1. Validates errors is an array
   * 2. For each error: validates required fields, cleans file paths and types, normalizes
   *    IssueType and SeverityLevel, parses line numbers, cleans descriptions and suggestions
   * 3. Passes cleaned errors to callback
   * 
   * @param input - Tool input containing errors array
   * @returns String response indicating success or error details
   * 
   * @throws Error if errors is not an array, required fields are missing, or validation fails
   * 
   * @remarks
   * - Empty errors array is valid and returns success message
   * - File paths are cleaned to remove markdown, prefixes, and newlines
   * - IssueType values are validated and normalized (fallback to CODE_ISSUE if invalid)
   * - SeverityLevel values must be exactly one of: critical, high, medium, low
   * - Line numbers are parsed from strings if needed (extracts first number found)
   * - Descriptions and suggestions are cleaned but preserve newlines for readability
   * - If multiple errors are concatenated in description, only first is extracted
   * 
   * @example
   * ```typescript
   * const result = await tool.execute({
   *   errors: [
   *     {
   *       file: '**src/utils.ts**',
   *       line: '42',
   *       type: 'BUG',
   *       severity: 'HIGH',
   *       description: '**Null pointer** exception',
   *       suggestion: 'Add null check'
   *     }
   *   ]
   * });
   * // Errors are cleaned: file='src/utils.ts', line=42, type='bug', severity='high'
   * // Returns: "Successfully reported 1 error(s). Errors have been recorded for analysis."
   * ```
   */
  async execute(input: Record<string, any>): Promise<string> {
    const { logInfo } = require('../../../utils/logger');
    const errors = input.errors as any[];

    // Validate errors is an array
    // @internal errors must be an array to process multiple errors at once
    if (!Array.isArray(errors)) {
      throw new Error('errors must be an array');
    }

    // Handle empty errors array
    // @internal Empty array is valid - means no errors were found during analysis
    if (errors.length === 0) {
      logInfo('   ✅ No errors reported');
      this.options.onErrorsReported([]);
      return 'No errors to report. All files analyzed successfully.';
    }

    logInfo(`   📋 Reporting ${errors.length} error(s) in structured format`);

    // Clean and validate each error
    // @internal Each error is processed individually to ensure all are valid before reporting
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
      const file = String(error.file)
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

      // Clean and validate type - must be a valid IssueType
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
        .trim()
        .toLowerCase();
      
      if (!type || type.length === 0) {
        throw new Error(`Error at index ${i}: type is required and cannot be empty`);
      }
      
      // Validate that type is a valid IssueType enum value
      if (!Object.values(IssueType).includes(type as IssueType)) {
        // Try to find a close match or use CODE_ISSUE as fallback
        const validTypes = Object.values(IssueType);
        const closeMatch = validTypes.find(t => t.includes(type) || type.includes(t));
        if (closeMatch) {
          type = closeMatch;
        } else {
          // Use generic fallback
          type = IssueType.CODE_ISSUE;
        }
      }

      // Validate and normalize severity
      const severity = String(error.severity).toLowerCase().trim();
      if (!Object.values(SeverityLevel).includes(severity as SeverityLevel)) {
        throw new Error(`Error at index ${i}: Invalid severity "${error.severity}". Must be one of: ${Object.values(SeverityLevel).join(', ')}`);
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
        type: type as IssueType,
        severity: severity as SeverityLevel,
        description,
        suggestion
      });
    }

    // Notify callback with cleaned errors
    this.options.onErrorsReported(cleanedErrors);

    return `Successfully reported ${cleanedErrors.length} error(s). Errors have been recorded for analysis.`;
  }
}

