/**
 * Propose Change Tool
 * Proposes changes to files in the virtual codebase
 */

import { BaseTool } from '../base_tool';

export type ChangeType = 'create' | 'modify' | 'delete' | 'refactor';

export interface ProposeChangeToolOptions {
  applyChange: (change: {
    file_path: string;
    change_type: ChangeType;
    description: string;
    suggested_code: string;
    reasoning: string;
  }) => boolean;
  onChangeApplied?: (change: any) => void;
}

export class ProposeChangeTool extends BaseTool {
  constructor(private options: ProposeChangeToolOptions) {
    super();
  }

  getName(): string {
    return 'propose_change';
  }

  getDescription(): string {
    return `Propose a change to a file in the virtual codebase. Changes are applied ONLY in memory (virtual codebase) and are NOT written to disk. 

**IMPORTANT**: This tool ONLY stores changes in memory. You MUST use apply_changes tool to actually write files to disk. 

**When to use propose_change**: Use this when you want to prepare multiple changes before applying them, or when you need to build upon changes incrementally.

**When NOT to use propose_change alone**: If the user asks you to "create", "write", "make", "build", "set up", or "modify" files, you MUST use apply_changes immediately after propose_change to actually create the files. Do not just propose changes and leave them in memory - the user expects files to be created on disk.`;
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
        file_path: {
          type: 'string',
          description: 'Path to the file to modify'
        },
        change_type: {
          type: 'string',
          enum: ['create', 'modify', 'delete', 'refactor'],
          description: 'Type of change to make: create (new file), modify (update existing code - use for bugfixes, features, updates), delete (remove file), refactor (restructure code without changing functionality)'
        },
        description: {
          type: 'string',
          description: 'Brief description of the change'
        },
        suggested_code: {
          type: 'string',
          description: 'The code to add or modify. For modifications, include the full modified section.'
        },
        reasoning: {
          type: 'string',
          description: 'Explanation of why this change is needed'
        }
      },
      required: ['file_path', 'change_type', 'description', 'suggested_code', 'reasoning'],
      additionalProperties: false
    };
  }

  async execute(input: Record<string, any>): Promise<string> {
    const { logInfo } = require('../../../utils/logger');
    const filePath = input.file_path as string;
    logInfo(`   ✏️ Proposing change: ${filePath} (${input.change_type})`);
    logInfo(`      Description: ${input.description?.substring(0, 100) || 'N/A'}${input.description && input.description.length > 100 ? '...' : ''}`);
    const changeType = input.change_type as ChangeType;
    const description = input.description as string;
    const suggestedCode = input.suggested_code as string;
    const reasoning = input.reasoning as string;

    // Validate
    if (!filePath || typeof filePath !== 'string') {
      throw new Error('file_path is required and must be a string');
    }

    const validChangeTypes: ChangeType[] = ['create', 'modify', 'delete', 'refactor'];
    if (!validChangeTypes.includes(changeType)) {
      throw new Error(`change_type must be one of: ${validChangeTypes.join(', ')}`);
    }

    if (!description || typeof description !== 'string') {
      throw new Error('description is required and must be a string');
    }

    if (!suggestedCode || typeof suggestedCode !== 'string') {
      throw new Error('suggested_code is required and must be a string');
    }

    if (!reasoning || typeof reasoning !== 'string') {
      throw new Error('reasoning is required and must be a string');
    }

    // Apply change
    const success = this.options.applyChange({
      file_path: filePath,
      change_type: changeType,
      description,
      suggested_code: suggestedCode,
      reasoning
    });

    if (success) {
      this.options.onChangeApplied?.({
        file_path: filePath,
        change_type: changeType,
        description
      });

      return `Change applied successfully to ${filePath}:\n${description}`;
    } else {
      return `Failed to apply change to ${filePath}. The file may not exist or the change type may be invalid.`;
    }
  }
}

