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
import { logInfo } from '../../../utils/logger';

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
export class ReportIntentTool extends BaseTool {
  /**
   * Creates a new ReportIntentTool instance.
   * 
   * @internal
   * The options parameter provides the callback that receives the classification decision.
   * 
   * @param options - Configuration object with callback for intent reporting
   */
  constructor(private options: ReportIntentToolOptions) {
    super();
  }

  /**
   * Returns the tool name used by the agent system.
   * 
   * @internal
   * This name is used when the agent calls the tool via tool calls.
   * 
   * @returns Tool identifier: 'report_intent'
   */
  getName(): string {
    return 'report_intent';
  }

  getDescription(): string {
    return 'Report your intent classification decision. Use this tool to report whether the user prompt is an ORDER (should apply changes) or a QUESTION (should not apply changes). This is the PRIMARY way to report your classification - you MUST use this tool after analyzing the prompt.';
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
        shouldApplyChanges: {
          type: 'boolean',
          description: 'true if the prompt is an order to create/modify/delete files, false if it\'s a question or doubt. MUST be a boolean (true or false), not a string.'
        },
        reasoning: {
          type: 'string',
          description: 'Brief explanation of your classification decision. Plain text description. Can contain newlines for readability, but NO markdown formatting (NO **, NO *, NO #). Just plain descriptive text explaining why you classified it this way.'
        },
        confidence: {
          type: 'string',
          enum: Object.values(ConfidenceLevel),
          description: 'Confidence level of your classification. MUST be exactly one of: "high", "medium", "low" (lowercase, no quotes in the value itself).'
        }
      },
      required: ['shouldApplyChanges', 'reasoning', 'confidence'],
      additionalProperties: false
    };
  }

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
  async execute(input: Record<string, unknown>): Promise<string> {
    // Validate shouldApplyChanges
    // @internal shouldApplyChanges is required to know whether to apply changes
    if (input.shouldApplyChanges === undefined || input.shouldApplyChanges === null) {
      throw new Error('shouldApplyChanges is required');
    }

    const shouldApplyChanges = Boolean(input.shouldApplyChanges);

    // Validate reasoning
    // @internal reasoning is required to explain the classification decision
    if (!input.reasoning || typeof input.reasoning !== 'string') {
      throw new Error('reasoning is required and must be a string');
    }

    // Clean reasoning - remove markdown but preserve content
    // @internal Remove markdown formatting to ensure clean plain text, but preserve newlines for readability
    const reasoning = String(input.reasoning)
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/^#+\s*/gm, '')
      .replace(/^-\s*/gm, '')
      .replace(/^\d+\.\s*/gm, '')
      .replace(/\\n/g, '\n')
      .trim();

    if (!reasoning || reasoning.length === 0) {
      throw new Error('reasoning is required and cannot be empty');
    }

    // Validate confidence
    // @internal confidence must be a valid ConfidenceLevel enum value
    if (!input.confidence || typeof input.confidence !== 'string') {
      throw new Error('confidence is required and must be a string');
    }

    const confidence = String(input.confidence).toLowerCase().trim();
    if (!Object.values(ConfidenceLevel).includes(confidence as ConfidenceLevel)) {
      throw new Error(`confidence must be one of: ${Object.values(ConfidenceLevel).join(', ')}, got: "${confidence}"`);
    }

    const confidenceLevel = confidence as ConfidenceLevel;

    logInfo(`   🎯 Intent reported: shouldApplyChanges=${shouldApplyChanges}, confidence=${confidenceLevel}`);
    logInfo(`   📝 Reasoning: ${reasoning.substring(0, 100)}${reasoning.length > 100 ? '...' : ''}`);

    // Notify callback
    // @internal Pass cleaned and validated data to callback
    this.options.onIntentReported(shouldApplyChanges, reasoning, confidenceLevel);

    return `Successfully reported intent classification: shouldApplyChanges=${shouldApplyChanges}, confidence=${confidenceLevel}. Classification has been recorded.`;
  }
}

