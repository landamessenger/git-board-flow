/**
 * Report Intent Tool
 * Tool for reporting intent classification decision in structured format
 */

import { BaseTool } from '../base_tool';
import { ConfidenceLevel } from '../../reasoning/intent_classifier/types';

export interface ReportIntentToolOptions {
  onIntentReported: (shouldApplyChanges: boolean, reasoning: string, confidence: ConfidenceLevel) => void;
}

export class ReportIntentTool extends BaseTool {
  constructor(private options: ReportIntentToolOptions) {
    super();
  }

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

  async execute(input: Record<string, any>): Promise<string> {
    const { logInfo } = require('../../../utils/logger');
    
    // Validate shouldApplyChanges
    if (input.shouldApplyChanges === undefined || input.shouldApplyChanges === null) {
      throw new Error('shouldApplyChanges is required');
    }

    const shouldApplyChanges = Boolean(input.shouldApplyChanges);

    // Validate reasoning
    if (!input.reasoning || typeof input.reasoning !== 'string') {
      throw new Error('reasoning is required and must be a string');
    }

    // Clean reasoning - remove markdown but preserve content
    let reasoning = String(input.reasoning)
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
    this.options.onIntentReported(shouldApplyChanges, reasoning, confidenceLevel);

    return `Successfully reported intent classification: shouldApplyChanges=${shouldApplyChanges}, confidence=${confidenceLevel}. Classification has been recorded.`;
  }
}

