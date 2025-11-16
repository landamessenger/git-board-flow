/**
 * Report Progress Tool
 * Tool for reporting task progress in structured format
 */

import { BaseTool } from '../base_tool';

export interface ReportProgressToolOptions {
  onProgressReported: (progress: number, summary: string) => void;
}

export class ReportProgressTool extends BaseTool {
  constructor(private options: ReportProgressToolOptions) {
    super();
  }

  getName(): string {
    return 'report_progress';
  }

  getDescription(): string {
    return 'Report the progress percentage of a task based on code changes analysis. Use this tool to report the completion percentage (0-100) and a brief summary of your assessment. This is the PRIMARY way to report progress - you MUST use this tool after analyzing the changes.';
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
        progress: {
          type: 'number',
          description: 'Progress percentage as a number between 0 and 100 (inclusive). 0 means nothing done, 100 means task is complete. MUST be a number, not a string.',
          minimum: 0,
          maximum: 100
        },
        summary: {
          type: 'string',
          description: 'Brief summary explaining why you assigned this progress percentage. Plain text description. Can contain newlines for readability, but NO markdown formatting (NO **, NO *, NO #). Just plain descriptive text explaining the assessment.'
        }
      },
      required: ['progress', 'summary'],
      additionalProperties: false
    };
  }

  async execute(input: Record<string, any>): Promise<string> {
    const { logInfo } = require('../../../utils/logger');
    
    // Validate progress
    if (input.progress === undefined || input.progress === null) {
      throw new Error('progress is required');
    }

    let progress: number;
    if (typeof input.progress === 'number') {
      progress = input.progress;
    } else if (typeof input.progress === 'string') {
      // Try to extract number from string
      const match = input.progress.match(/(\d+(?:\.\d+)?)/);
      if (match) {
        progress = parseFloat(match[1]);
      } else {
        throw new Error(`Invalid progress value: "${input.progress}". Must be a number between 0 and 100.`);
      }
    } else {
      throw new Error(`Invalid progress type: ${typeof input.progress}. Must be a number between 0 and 100.`);
    }

    // Validate progress range
    if (isNaN(progress) || progress < 0 || progress > 100) {
      throw new Error(`Progress must be a number between 0 and 100, got: ${progress}`);
    }

    // Round to integer
    progress = Math.round(progress);

    // Validate summary
    if (!input.summary || typeof input.summary !== 'string') {
      throw new Error('summary is required and must be a string');
    }

    // Clean summary - remove markdown but preserve content
    let summary = String(input.summary)
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/^#+\s*/gm, '')
      .replace(/^-\s*/gm, '')
      .replace(/^\d+\.\s*/gm, '')
      .replace(/\\n/g, '\n')
      .trim();

    if (!summary || summary.length === 0) {
      throw new Error('summary is required and cannot be empty');
    }

    logInfo(`   📊 Progress reported: ${progress}%`);
    logInfo(`   📝 Summary: ${summary.substring(0, 100)}${summary.length > 100 ? '...' : ''}`);

    // Notify callback
    this.options.onProgressReported(progress, summary);

    return `Successfully reported progress: ${progress}%. Progress has been recorded.`;
  }
}

