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
import { DetectedError } from '../../reasoning/error_detector/types';
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
export declare class ReportErrorsTool extends BaseTool {
    private options;
    /**
     * Creates a new ReportErrorsTool instance.
     *
     * @internal
     * The options parameter provides the callback that receives cleaned and validated errors.
     *
     * @param options - Configuration object with callback for error reporting
     */
    constructor(options: ReportErrorsToolOptions);
    /**
     * Returns the tool name used by the agent system.
     *
     * @internal
     * This name is used when the agent calls the tool via tool calls.
     *
     * @returns Tool identifier: 'report_errors'
     */
    getName(): string;
    getDescription(): string;
    getInputSchema(): {
        type: 'object';
        properties: Record<string, any>;
        required: string[];
        additionalProperties?: boolean;
    };
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
    execute(input: Record<string, unknown>): Promise<string>;
}
