/**
 * Tests for ToolRegistry
 */

import { ToolRegistry } from '../tools/tool_registry';
import { BaseTool } from '../tools/base_tool';

// Mock tool for testing
class MockTool extends BaseTool {
  constructor(private name: string, private description: string) {
    super();
  }

  getName(): string {
    return this.name;
  }

  getDescription(): string {
    return this.description;
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
    return `Result: ${input.input}`;
  }
}

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  describe('Registration', () => {
    it('should register a tool', () => {
      const tool = new MockTool('test_tool', 'Test tool');
      registry.register(tool);
      
      expect(registry.has('test_tool')).toBe(true);
      expect(registry.get('test_tool')).toBe(tool);
    });

    it('should throw error when registering duplicate tool', () => {
      const tool1 = new MockTool('test_tool', 'Test tool');
      const tool2 = new MockTool('test_tool', 'Another test tool');
      
      registry.register(tool1);
      
      expect(() => registry.register(tool2)).toThrow('already registered');
    });

    it('should register multiple tools', () => {
      const tool1 = new MockTool('tool1', 'Tool 1');
      const tool2 = new MockTool('tool2', 'Tool 2');
      const tool3 = new MockTool('tool3', 'Tool 3');
      
      registry.registerAll([tool1, tool2, tool3]);
      
      expect(registry.getCount()).toBe(3);
      expect(registry.has('tool1')).toBe(true);
      expect(registry.has('tool2')).toBe(true);
      expect(registry.has('tool3')).toBe(true);
    });
  });

  describe('Retrieval', () => {
    it('should get tool by name', () => {
      const tool = new MockTool('test_tool', 'Test tool');
      registry.register(tool);
      
      const retrieved = registry.get('test_tool');
      expect(retrieved).toBe(tool);
    });

    it('should return undefined for non-existent tool', () => {
      expect(registry.get('non_existent')).toBeUndefined();
    });

    it('should check if tool exists', () => {
      const tool = new MockTool('test_tool', 'Test tool');
      registry.register(tool);
      
      expect(registry.has('test_tool')).toBe(true);
      expect(registry.has('non_existent')).toBe(false);
    });
  });

  describe('Tool Definitions', () => {
    it('should get all tool definitions', () => {
      const tool1 = new MockTool('tool1', 'Tool 1');
      const tool2 = new MockTool('tool2', 'Tool 2');
      
      registry.registerAll([tool1, tool2]);
      
      const definitions = registry.getAllDefinitions();
      
      expect(definitions.length).toBe(2);
      expect(definitions[0].name).toBe('tool1');
      expect(definitions[1].name).toBe('tool2');
    });

    it('should get tool names', () => {
      const tool1 = new MockTool('tool1', 'Tool 1');
      const tool2 = new MockTool('tool2', 'Tool 2');
      
      registry.registerAll([tool1, tool2]);
      
      const names = registry.getToolNames();
      
      expect(names).toContain('tool1');
      expect(names).toContain('tool2');
      expect(names.length).toBe(2);
    });
  });

  describe('Clear', () => {
    it('should clear all tools', () => {
      const tool1 = new MockTool('tool1', 'Tool 1');
      const tool2 = new MockTool('tool2', 'Tool 2');
      
      registry.registerAll([tool1, tool2]);
      expect(registry.getCount()).toBe(2);
      
      registry.clear();
      
      expect(registry.getCount()).toBe(0);
      expect(registry.has('tool1')).toBe(false);
      expect(registry.has('tool2')).toBe(false);
    });
  });

  describe('Count', () => {
    it('should return correct count', () => {
      expect(registry.getCount()).toBe(0);
      
      registry.register(new MockTool('tool1', 'Tool 1'));
      expect(registry.getCount()).toBe(1);
      
      registry.register(new MockTool('tool2', 'Tool 2'));
      expect(registry.getCount()).toBe(2);
    });
  });
});

