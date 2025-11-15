/**
 * Tests for ToolExecutor
 */

import { ToolExecutor } from '../tools/tool_executor';
import { ToolRegistry } from '../tools/tool_registry';
import { BaseTool } from '../tools/base_tool';
import { ToolCall } from '../types';

// Mock tool for testing
class MockTool extends BaseTool {
  constructor(
    private name: string,
    private shouldFail: boolean = false,
    private shouldThrow: boolean = false
  ) {
    super();
  }

  getName(): string {
    return this.name;
  }

  getDescription(): string {
    return `Mock tool: ${this.name}`;
  }

  getInputSchema(): any {
    return {
      type: 'object',
      properties: {
        input: { type: 'string' }
      },
      required: ['input']
    };
  }

  async execute(input: Record<string, any>): Promise<any> {
    if (this.shouldThrow) {
      throw new Error('Tool execution error');
    }

    if (this.shouldFail) {
      throw new Error('Tool failed');
    }

    return `Result from ${this.name}: ${input.input}`;
  }
}

describe('ToolExecutor', () => {
  let registry: ToolRegistry;
  let executor: ToolExecutor;

  beforeEach(() => {
    registry = new ToolRegistry();
    executor = new ToolExecutor(registry);
  });

  describe('Single Tool Execution', () => {
    it('should execute tool successfully', async () => {
      const tool = new MockTool('test_tool');
      registry.register(tool);

      const toolCall: ToolCall = {
        id: 'call_1',
        name: 'test_tool',
        input: { input: 'test value' }
      };

      const result = await executor.execute(toolCall);

      expect(result.toolCallId).toBe('call_1');
      expect(result.isError).toBeFalsy();
      expect(result.content).toContain('Result from test_tool');
    });

    it('should return error for non-existent tool', async () => {
      const toolCall: ToolCall = {
        id: 'call_1',
        name: 'non_existent',
        input: {}
      };

      const result = await executor.execute(toolCall);

      expect(result.isError).toBe(true);
      expect(result.content).toContain('not found');
    });

    it('should handle tool execution failure', async () => {
      const tool = new MockTool('failing_tool', true);
      registry.register(tool);

      const toolCall: ToolCall = {
        id: 'call_1',
        name: 'failing_tool',
        input: { input: 'test' }
      };

      const result = await executor.execute(toolCall);

      expect(result.isError).toBe(true);
      expect(result.content).toContain('failed');
    });

    it('should handle tool execution exception', async () => {
      const tool = new MockTool('throwing_tool', false, true);
      registry.register(tool);

      const toolCall: ToolCall = {
        id: 'call_1',
        name: 'throwing_tool',
        input: { input: 'test' }
      };

      const result = await executor.execute(toolCall);

      expect(result.isError).toBe(true);
      expect(result.content).toContain('Tool execution error');
    });

    it('should convert non-string results to JSON', async () => {
      class ObjectTool extends BaseTool {
        getName() { return 'object_tool'; }
        getDescription() { return 'Returns object'; }
        getInputSchema() {
          return { 
            type: 'object' as const, 
            properties: {}, 
            required: [] as string[] 
          };
        }
        async execute() {
          return { key: 'value', number: 42 };
        }
      }

      registry.register(new ObjectTool());

      const toolCall: ToolCall = {
        id: 'call_1',
        name: 'object_tool',
        input: {}
      };

      const result = await executor.execute(toolCall);

      expect(result.isError).toBeFalsy();
      expect(result.content).toContain('"key": "value"');
      expect(result.content).toContain('"number": 42');
    });
  });

  describe('Multiple Tool Execution', () => {
    it('should execute multiple tools in parallel', async () => {
      registry.register(new MockTool('tool1'));
      registry.register(new MockTool('tool2'));

      const toolCalls: ToolCall[] = [
        { id: 'call_1', name: 'tool1', input: { input: 'value1' } },
        { id: 'call_2', name: 'tool2', input: { input: 'value2' } }
      ];

      const results = await executor.executeAll(toolCalls);

      expect(results).toHaveLength(2);
      expect(results[0].toolCallId).toBe('call_1');
      expect(results[1].toolCallId).toBe('call_2');
      expect(results[0].isError).toBeFalsy();
      expect(results[1].isError).toBeFalsy();
    });

    it('should execute multiple tools sequentially', async () => {
      registry.register(new MockTool('tool1'));
      registry.register(new MockTool('tool2'));

      const toolCalls: ToolCall[] = [
        { id: 'call_1', name: 'tool1', input: { input: 'value1' } },
        { id: 'call_2', name: 'tool2', input: { input: 'value2' } }
      ];

      const results = await executor.executeAllSequential(toolCalls);

      expect(results).toHaveLength(2);
      expect(results[0].toolCallId).toBe('call_1');
      expect(results[1].toolCallId).toBe('call_2');
    });

    it('should handle mix of successful and failed tools', async () => {
      registry.register(new MockTool('tool1'));
      registry.register(new MockTool('failing_tool', true));

      const toolCalls: ToolCall[] = [
        { id: 'call_1', name: 'tool1', input: { input: 'value1' } },
        { id: 'call_2', name: 'failing_tool', input: { input: 'value2' } }
      ];

      const results = await executor.executeAll(toolCalls);

      expect(results).toHaveLength(2);
      expect(results[0].isError).toBeFalsy();
      expect(results[1].isError).toBe(true);
    });
  });

  describe('Tool Availability', () => {
    it('should check if tool is available', () => {
      registry.register(new MockTool('available_tool'));

      expect(executor.isToolAvailable('available_tool')).toBe(true);
      expect(executor.isToolAvailable('non_existent')).toBe(false);
    });

    it('should get available tool names', () => {
      registry.register(new MockTool('tool1'));
      registry.register(new MockTool('tool2'));

      const tools = executor.getAvailableTools();

      expect(tools).toContain('tool1');
      expect(tools).toContain('tool2');
      expect(tools.length).toBe(2);
    });
  });
});

