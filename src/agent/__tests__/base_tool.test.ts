/**
 * Tests for BaseTool
 */

import { BaseTool } from '../tools/base_tool';

// Concrete implementation for testing
class TestTool extends BaseTool {
  getName(): string {
    return 'test_tool';
  }

  getDescription(): string {
    return 'A test tool';
  }

  getInputSchema(): any {
    return {
      type: 'object',
      properties: {
        required_field: { type: 'string' },
        optional_field: { type: 'string' }
      },
      required: ['required_field'],
      additionalProperties: false
    };
  }

  async execute(input: Record<string, any>): Promise<any> {
    return `Result: ${input.required_field}`;
  }
}

describe('BaseTool', () => {
  let tool: TestTool;

  beforeEach(() => {
    tool = new TestTool();
  });

  describe('getDefinition', () => {
    it('should return tool definition', () => {
      const definition = tool.getDefinition();

      expect(definition.name).toBe('test_tool');
      expect(definition.description).toBe('A test tool');
      expect(definition.inputSchema.type).toBe('object');
    });
  });

  describe('validateInput', () => {
    it('should validate correct input', () => {
      const input = { required_field: 'value' };
      const result = tool.validateInput(input);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject input missing required field', () => {
      const input = { optional_field: 'value' };
      const result = tool.validateInput(input);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('required');
    });

    it('should reject input with additional properties when not allowed', () => {
      const input = {
        required_field: 'value',
        extra_field: 'not allowed'
      };
      const result = tool.validateInput(input);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unexpected field');
    });

    it('should allow additional properties when schema allows', () => {
      class FlexibleTool extends BaseTool {
        getName() { return 'flexible'; }
        getDescription() { return 'Flexible tool'; }
        getInputSchema() {
          return {
            type: 'object' as const,
            properties: { field: { type: 'string' } },
            required: [] as string[],
            additionalProperties: true
          };
        }
        async execute() { return 'ok'; }
      }

      const flexibleTool = new FlexibleTool();
      const input = { field: 'value', extra: 'allowed' };
      const result = flexibleTool.validateInput(input);

      expect(result.valid).toBe(true);
    });
  });

  describe('executeWithValidation', () => {
    it('should execute with valid input', async () => {
      const input = { required_field: 'test value' };
      const result = await tool.executeWithValidation(input);

      expect(result.success).toBe(true);
      expect(result.result).toContain('test value');
      expect(result.error).toBeUndefined();
    });

    it('should reject invalid input', async () => {
      const input = { wrong_field: 'value' };
      const result = await tool.executeWithValidation(input);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.result).toBeNull();
    });

    it('should handle execution errors', async () => {
      class ErrorTool extends BaseTool {
        getName() { return 'error_tool'; }
        getDescription() { return 'Tool that throws'; }
        getInputSchema() {
          return { 
            type: 'object' as const, 
            properties: {}, 
            required: [] as string[] 
          };
        }
        async execute() {
          throw new Error('Execution failed');
        }
      }

      const errorTool = new ErrorTool();
      const result = await errorTool.executeWithValidation({});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Execution failed');
    });
  });
});

