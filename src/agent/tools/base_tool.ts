/**
 * Base class for all tools
 */

import { ToolDefinition, ToolCall, ToolExecutionResult } from '../types';

export abstract class BaseTool {
  /**
   * Get tool name
   */
  abstract getName(): string;

  /**
   * Get tool description
   */
  abstract getDescription(): string;

  /**
   * Get input schema (JSON Schema format)
   */
  abstract getInputSchema(): {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
    additionalProperties?: boolean;
  };

  /**
   * Execute the tool
   */
  abstract execute(input: Record<string, any>): Promise<any>;

  /**
   * Get tool definition
   */
  getDefinition(): ToolDefinition {
    return {
      name: this.getName(),
      description: this.getDescription(),
      inputSchema: this.getInputSchema()
    };
  }

  /**
   * Validate input against schema
   */
  validateInput(input: Record<string, any>): { valid: boolean; error?: string } {
    const schema = this.getInputSchema();
    
    // Check required fields
    for (const required of schema.required) {
      if (!(required in input)) {
        return {
          valid: false,
          error: `Missing required field: ${required}`
        };
      }
    }

    // Check additional properties
    if (schema.additionalProperties === false) {
      const allowedKeys = new Set([
        ...Object.keys(schema.properties),
        ...schema.required
      ]);

      for (const key of Object.keys(input)) {
        if (!allowedKeys.has(key)) {
          return {
            valid: false,
            error: `Unexpected field: ${key}`
          };
        }
      }
    }

    return { valid: true };
  }

  /**
   * Execute with validation
   */
  async executeWithValidation(input: Record<string, any>): Promise<ToolExecutionResult> {
    const validation = this.validateInput(input);
    
    if (!validation.valid) {
      return {
        success: false,
        result: null,
        error: validation.error
      };
    }

    try {
      const result = await this.execute(input);
      return {
        success: true,
        result
      };
    } catch (error) {
      return {
        success: false,
        result: null,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

