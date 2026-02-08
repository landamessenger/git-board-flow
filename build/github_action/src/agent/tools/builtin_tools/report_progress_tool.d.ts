/**
 * Report Progress Tool - Tool for reporting task progress in structured format.
 *
 * This tool allows agents to report the progress percentage of a task based on code changes
 * analysis. It reports the completion percentage (0-100) and a brief summary of the assessment.
 * This is the primary way for agents to report progress after analyzing changes.
 *
 * @internal
 * This tool is used by the ProgressDetector agent to report task completion percentage. The tool
 * validates progress is within 0-100 range, cleans the summary text to remove markdown formatting,
 * and rounds progress to integer for consistency.
 *
 * @remarks
 * - progress must be a number between 0 and 100 (inclusive)
 * - Progress can be provided as number or string (extracts number from string)
 * - Progress is rounded to integer for consistency
 * - summary is cleaned to remove markdown formatting but preserves newlines
 * - This is the PRIMARY way to report progress - agents MUST use this tool
 *
 * @example
 * ```typescript
 * const tool = new ReportProgressTool({
 *   onProgressReported: (progress, summary) => {
 *     console.log(`Progress: ${progress}%`);
 *   }
 * });
 *
 * await tool.execute({
 *   progress: 75,
 *   summary: 'Most changes are complete, only tests remaining'
 * });
 * ```
 */
import { BaseTool } from '../base_tool';
/**
 * Options for configuring the ReportProgressTool.
 *
 * @internal
 * The callback connects the tool to the progress reporting system, allowing progress
 * assessments to be processed and stored.
 *
 * @property onProgressReported - Callback invoked with progress percentage and cleaned summary.
 */
export interface ReportProgressToolOptions {
    /**
     * Callback invoked when progress is reported.
     *
     * @internal
     * This callback receives the progress percentage (0-100, rounded to integer) and cleaned
     * summary text. The summary has been cleaned to remove markdown formatting.
     *
     * @param progress - Progress percentage (0-100, integer)
     * @param summary - Cleaned summary text explaining the progress assessment
     */
    onProgressReported: (progress: number, summary: string) => void;
}
/**
 * ReportProgressTool - Tool for reporting task progress in structured format.
 *
 * This tool provides a structured interface for agents to report task completion percentage.
 * It validates progress range, cleans summary text, and ensures data consistency.
 *
 * @internal
 * The tool performs validation and cleaning:
 * - Validates progress is within 0-100 range
 * - Parses progress from string if needed (extracts first number)
 * - Rounds progress to integer for consistency
 * - Cleans summary to remove markdown formatting (preserves newlines)
 * - Passes cleaned data to callback
 */
export declare class ReportProgressTool extends BaseTool {
    private options;
    /**
     * Creates a new ReportProgressTool instance.
     *
     * @internal
     * The options parameter provides the callback that receives the progress assessment.
     *
     * @param options - Configuration object with callback for progress reporting
     */
    constructor(options: ReportProgressToolOptions);
    /**
     * Returns the tool name used by the agent system.
     *
     * @internal
     * This name is used when the agent calls the tool via tool calls.
     *
     * @returns Tool identifier: 'report_progress'
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
     * This method validates and processes the progress assessment, parses progress from number
     * or string, validates the range, cleans the summary text, and passes the cleaned data
     * to the callback.
     *
     * @internal
     * The method performs the following steps:
     * 1. Validates progress is provided
     * 2. Parses progress from number or string (extracts first number from string)
     * 3. Validates progress is within 0-100 range
     * 4. Rounds progress to integer for consistency
     * 5. Validates summary is provided and is a string
     * 6. Cleans summary to remove markdown formatting (preserves newlines)
     * 7. Passes cleaned data to callback
     *
     * @param input - Tool input containing progress and summary
     * @returns String response indicating success
     *
     * @throws Error if progress is missing, invalid, or out of range; or if summary is missing or empty after cleaning
     *
     * @remarks
     * - Progress can be provided as number or string (extracts first number from string)
     * - Progress is rounded to integer for consistency (e.g., 75.5 becomes 76)
     * - Summary is cleaned to remove markdown but preserves newlines for readability
     * - Empty summary after cleaning throws an error
     *
     * @example
     * ```typescript
     * // With number
     * const result = await tool.execute({
     *   progress: 75,
     *   summary: '**Most changes** are complete'
     * });
     * // Progress: 75, Summary: 'Most changes are complete'
     *
     * // With string
     * const result2 = await tool.execute({
     *   progress: '50%',
     *   summary: 'Halfway done'
     * });
     * // Progress: 50, Summary: 'Halfway done'
     * ```
     */
    execute(input: Record<string, any>): Promise<string>;
}
