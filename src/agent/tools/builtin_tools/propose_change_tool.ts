/**
 * Propose Change Tool
 * Proposes changes to files in the virtual codebase
 */

import { BaseTool } from '../base_tool';
import { ChangeType } from '../../../data/model/think_response';

export interface ProposeChangeToolOptions {
  applyChange: (change: {
    file_path: string;
    change_type: ChangeType;
    description: string;
    suggested_code: string;
    reasoning: string;
  }) => boolean;
  onChangeApplied?: (change: any) => void;
  autoApplyToDisk?: (filePath: string, operation?: ChangeType) => Promise<boolean>; // Optional: auto-apply to disk when provided
  getUserPrompt?: () => string | undefined; // Optional: get original user prompt to detect if it's an order (fallback)
  getShouldApplyChanges?: () => boolean | undefined; // Optional: get pre-classified intent from intent classifier
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

**AUTO-APPLY BEHAVIOR**:
- If user prompt is an ORDER (create, write, make, build, set up, modify): auto_apply is automatically enabled
- If user prompt is a QUESTION (what, how, why, should, could): auto_apply is disabled (exploration mode)
- You can override with explicit auto_apply parameter if needed

**When user gives CLEAR ORDERS** (create, write, make, build, set up, modify):
- auto_apply is automatically enabled - files are written to disk immediately
- No need to specify auto_apply=true manually (but you can if you want to be explicit)

**When user asks QUESTIONS or has DOUBTS** (exploration):
- auto_apply is automatically disabled - changes stay in memory for discussion
- Use apply_changes later if user wants to apply

**Parameters**:
- auto_apply (boolean, optional): Override auto-detection. If true, writes to disk. If false, stays in memory. If not specified, auto-detects from user prompt.

**IMPORTANT**: 
- For clear orders: auto_apply is automatic - files are created on disk
- For questions/doubts: auto_apply is disabled - changes stay in memory for discussion`;
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
          enum: Object.values(ChangeType),
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

  /**
   * Detect if user prompt is an order (not a question)
   */
  private isOrderPrompt(prompt?: string): boolean {
    if (!prompt) return false;
    const promptLower = prompt.toLowerCase();
    
    // Strong question indicators (these take priority)
    const strongQuestionIndicators = ['?', 'what', 'how', 'why', 'when', 'where', 'which', 'should', 'could', 'would', 'can you explain', 'tell me', 'describe', 'analyze'];
    const hasStrongQuestion = strongQuestionIndicators.some(indicator => promptLower.includes(indicator));
    
    // Order indicators
    const orderIndicators = ['create', 'write', 'make', 'build', 'set up', 'modify', 'add', 'implement', 'generate', 'do', 'ensure', 'verify', 'test', 'run', 'execute', 'delete', 'remove', 'eliminate'];
    const hasOrder = orderIndicators.some(indicator => promptLower.includes(indicator));
    
    // If it has a question mark or strong question words, it's a question (not an order)
    if (hasStrongQuestion) {
      // Exception: if it's a question about implementing (e.g., "How should I implement X?")
      // but also contains clear order words without question context, check more carefully
      if (promptLower.includes('?') || promptLower.startsWith('what') || promptLower.startsWith('how') || 
          promptLower.startsWith('why') || promptLower.startsWith('when') || promptLower.startsWith('where')) {
        return false; // Clear question format
      }
    }
    
    // If it's clearly an order without question indicators, return true
    if (hasOrder && !hasStrongQuestion) return true;
    
    // Default: if no question mark and has action verbs, treat as order
    return !prompt.includes('?') && hasOrder;
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

    if (!Object.values(ChangeType).includes(changeType)) {
      throw new Error(`change_type must be one of: ${Object.values(ChangeType).join(', ')}`);
    }

    if (!description || typeof description !== 'string') {
      throw new Error('description is required and must be a string');
    }

    // suggested_code is required but can be empty string for delete operations
    if (suggestedCode === undefined || suggestedCode === null || typeof suggestedCode !== 'string') {
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

      // Auto-detect if should auto-apply: check in order:
      // 1. Explicit input parameter
      // 2. Pre-classified intent from intent classifier
      // 3. Fallback to user prompt analysis (if classifier not used)
      let shouldAutoApply = false;
      
      // If explicitly set to true, use it
      if (input.auto_apply === true) {
        shouldAutoApply = true;
      }
      // If explicitly set to false, don't auto-apply
      else if (input.auto_apply === false) {
        shouldAutoApply = false;
      }
      // If not explicitly set, check pre-classified intent first (from intent classifier)
      else {
        const preClassifiedIntent = this.options.getShouldApplyChanges?.();
        if (preClassifiedIntent !== undefined) {
          shouldAutoApply = preClassifiedIntent;
          logInfo(`   🎯 Using intent classifier result: shouldApplyChanges=${shouldAutoApply}`);
        }
        // Fallback to user prompt analysis (if classifier not used)
        else {
          const userPrompt = this.options.getUserPrompt?.();
          if (userPrompt && this.isOrderPrompt(userPrompt)) {
            shouldAutoApply = true;
            logInfo(`   🔄 Auto-detected order prompt (fallback), enabling auto_apply`);
          }
        }
      }

      // Auto-apply to disk if requested and handler is available
      if (shouldAutoApply && this.options.autoApplyToDisk) {
        try {
          // For delete operations, we need special handling
          if (changeType === ChangeType.DELETE) {
            const applied = await this.options.autoApplyToDisk(filePath, ChangeType.DELETE);
            if (applied) {
              return `File deleted from disk: ${filePath}`;
            } else {
              return `Change proposed to virtual codebase: ${filePath}:\n${description}\nNote: Auto-delete from disk was requested but failed. Use apply_changes tool manually.`;
            }
          } else {
            // For create/modify/refactor
            const applied = await this.options.autoApplyToDisk(filePath, changeType);
            if (applied) {
              return `Change proposed and automatically applied to disk: ${filePath}:\n${description}`;
            } else {
              return `Change proposed to virtual codebase: ${filePath}:\n${description}\nNote: Auto-apply to disk was requested but failed. Use apply_changes tool manually.`;
            }
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

