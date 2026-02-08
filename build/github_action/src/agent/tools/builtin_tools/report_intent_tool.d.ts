/**
 * Report Intent Tool - Tool for reporting intent classification decision in structured format.
 *
 * This tool allows agents to report their intent classification decision, indicating whether
 * the user prompt is an ORDER (should apply changes) or a QUESTION (should not apply changes).
 * This is the primary way for agents to report their classification after analyzing the prompt.
 *
 * @internal
 * This tool is used by the IntentClassifier agent to report classification decisions. The tool
 * validates and cleans the reasoning text, ensuring it's plain text without markdown formatting,
 * and validates the confidence level against the ConfidenceLevel enum.
 *
 * @remarks
 * - shouldApplyChanges must be a boolean (true for orders, false for questions)
 * - reasoning is cleaned to remove markdown formatting but preserves newlines
 * - confidence must be one of: high, medium, low (from ConfidenceLevel enum)
 * - This is the PRIMARY way to report intent classification - agents MUST use this tool
 *
 * @example
 * ```typescript
 * const tool = new ReportIntentTool({
 *   onIntentReported: (shouldApply, reasoning, confidence) => {
 *     console.log('Intent:', shouldApply, confidence);
 *   }
 * });
 *
 * await tool.execute({
 *   shouldApplyChanges: true,
 *   reasoning: 'User said "create a file" which is a clear order',
 *   confidence: 'high'
 * });
 * ```
 */
import { BaseTool } from '../base_tool';
import { ConfidenceLevel } from '../../reasoning/intent_classifier/types';
/**
 * Options for configuring the ReportIntentTool.
 *
 * @internal
 * The callback connects the tool to the intent reporting system, allowing classification
 * decisions to be processed and stored.
 *
 * @property onIntentReported - Callback invoked with classification decision, reasoning, and confidence.
 */
export interface ReportIntentToolOptions {
    /**
     * Callback invoked when intent is reported.
     *
     * @internal
     * This callback receives the classification decision (shouldApplyChanges), cleaned reasoning,
     * and validated confidence level. The reasoning has been cleaned to remove markdown formatting.
     *
     * @param shouldApplyChanges - true if prompt is an order, false if it's a question
     * @param reasoning - Cleaned reasoning text explaining the classification
     * @param confidence - Confidence level (high, medium, or low)
     */
    onIntentReported: (shouldApplyChanges: boolean, reasoning: string, confidence: ConfidenceLevel) => void;
}
/**
 * ReportIntentTool - Tool for reporting intent classification decisions.
 *
 * This tool provides a structured interface for agents to report their intent classification
 * decisions. It validates inputs, cleans reasoning text, and ensures confidence levels are valid.
 *
 * @internal
 * The tool performs validation and cleaning:
 * - Validates shouldApplyChanges is a boolean
 * - Cleans reasoning to remove markdown formatting (preserves newlines)
 * - Validates confidence level against ConfidenceLevel enum
 * - Passes cleaned data to callback
 */
export declare class ReportIntentTool extends BaseTool {
    private options;
    /**
     * Creates a new ReportIntentTool instance.
     *
     * @internal
     * The options parameter provides the callback that receives the classification decision.
     *
     * @param options - Configuration object with callback for intent reporting
     */
    constructor(options: ReportIntentToolOptions);
    /**
     * Returns the tool name used by the agent system.
     *
     * @internal
     * This name is used when the agent calls the tool via tool calls.
     *
     * @returns Tool identifier: 'report_intent'
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
     * This method validates and processes the intent classification decision, cleans the reasoning
     * text, and passes the cleaned data to the callback.
     *
     * @internal
     * The method performs the following steps:
     * 1. Validates shouldApplyChanges is provided and converts to boolean
     * 2. Validates reasoning is provided and is a string
     * 3. Cleans reasoning to remove markdown formatting (preserves newlines)
     * 4. Validates confidence is provided and is a valid ConfidenceLevel enum value
     * 5. Passes cleaned data to callback
     *
     * @param input - Tool input containing shouldApplyChanges, reasoning, and confidence
     * @returns String response indicating success
     *
     * @throws Error if required fields are missing, reasoning is empty after cleaning, or confidence is invalid
     *
     * @remarks
     * - shouldApplyChanges is converted to boolean (handles truthy/falsy values)
     * - Reasoning is cleaned to remove markdown but preserves newlines for readability
     * - Confidence is normalized to lowercase and validated against ConfidenceLevel enum
     * - Empty reasoning after cleaning throws an error
     *
     * @example
     * ```typescript
     * const result = await tool.execute({
     *   shouldApplyChanges: true,
     *   reasoning: '**User said** "create a file" which is a clear order',
     *   confidence: 'HIGH'
     * });
     * // Reasoning is cleaned: 'User said "create a file" which is a clear order'
     * // Confidence is normalized: 'high'
     * // Returns: "Successfully reported intent classification: shouldApplyChanges=true, confidence=high. Classification has been recorded."
     * ```
     */
    execute(input: Record<string, any>): Promise<string>;
}
