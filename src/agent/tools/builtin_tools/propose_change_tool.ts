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
  autoApplyToDisk?: (filePath: string) => Promise<boolean>; // Optional: auto-apply to disk when provided
}

export class ProposeChangeTool extends BaseTool {
  constructor(private options: ProposeChangeToolOptions) {
    super();
  }

  getName(): string {
    return 'propose_change';
  }

  getDescription(): string {
    return `Propose a change to a file in the virtual codebase. Changes are applied in memory (virtual codebase).

**When user gives CLEAR ORDERS** (create, write, make, build, set up, modify):
- Use propose_change with auto_apply=true to automatically write to disk
- This combines propose + apply in one step
- Example: propose_change(..., auto_apply=true)

**When user asks QUESTIONS or has DOUBTS** (exploration):
- Use propose_change with auto_apply=false (or omit it)
- Changes stay in memory for discussion
- Use apply_changes later if user wants to apply

**Parameters**:
- auto_apply (boolean, optional): If true, automatically writes to disk after proposing. Use this for clear orders. Default: false.

**IMPORTANT**: 
- For clear orders: use propose_change with auto_apply=true (one step)
- For questions/doubts: use propose_change with auto_apply=false (exploration only)`;
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
        },
        auto_apply: {
          type: 'boolean',
          description: 'If true, automatically apply changes to disk immediately after proposing (default: false). Use this when user gives clear orders to create/modify files.'
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

    // Apply change to virtual codebase
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

      // Auto-apply to disk if requested and handler is available
      const autoApply = input.auto_apply === true;
      if (autoApply && this.options.autoApplyToDisk) {
        try {
          const applied = await this.options.autoApplyToDisk(filePath);
          if (applied) {
            return `Change proposed and automatically applied to disk: ${filePath}:\n${description}`;
          } else {
            return `Change proposed to virtual codebase: ${filePath}:\n${description}\nNote: Auto-apply to disk was requested but failed. Use apply_changes tool manually.`;
          }
        } catch (error: any) {
          return `Change proposed to virtual codebase: ${filePath}:\n${description}\nNote: Auto-apply to disk failed: ${error.message}. Use apply_changes tool manually.`;
        }
      }

      return `Change applied successfully to ${filePath}:\n${description}`;
    } else {
      return `Failed to apply change to ${filePath}. The file may not exist or the change type may be invalid.`;
    }
  }
}

