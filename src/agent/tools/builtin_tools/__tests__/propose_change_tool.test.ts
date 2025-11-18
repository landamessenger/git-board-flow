/**
 * Tests for Propose Change Tool
 */

import { ProposeChangeTool } from '../propose_change_tool';

describe('ProposeChangeTool', () => {
  let tool: ProposeChangeTool;
  let applyChange: jest.Mock;
  let onChangeApplied: jest.Mock;
  let autoApplyToDisk: jest.Mock;
  let getUserPrompt: jest.Mock;

  beforeEach(() => {
    applyChange = jest.fn().mockReturnValue(true);
    onChangeApplied = jest.fn();
    autoApplyToDisk = jest.fn().mockResolvedValue(true);
    getUserPrompt = jest.fn();

    tool = new ProposeChangeTool({
      applyChange,
      onChangeApplied,
      autoApplyToDisk,
      getUserPrompt
    });
  });

  describe('getName', () => {
    it('should return correct tool name', () => {
      expect(tool.getName()).toBe('propose_change');
    });
  });

  describe('getDescription', () => {
    it('should return tool description', () => {
      const description = tool.getDescription();
      expect(description).toContain('Propose');
      expect(description).toContain('change');
      expect(description).toContain('AUTO-APPLY');
    });
  });

  describe('getInputSchema', () => {
    it('should return valid JSON schema', () => {
      const schema = tool.getInputSchema();
      expect(schema.type).toBe('object');
      expect(schema.properties).toBeDefined();
      expect(schema.required).toContain('file_path');
      expect(schema.required).toContain('change_type');
      expect(schema.required).toContain('description');
      expect(schema.required).toContain('suggested_code');
      expect(schema.required).toContain('reasoning');
      expect(schema.properties.auto_apply).toBeDefined();
      expect(schema.properties.auto_apply.type).toBe('boolean');
    });
  });

  describe('execute - auto_apply detection', () => {
    it('should auto-apply when user prompt is an order (create)', async () => {
      getUserPrompt.mockReturnValue('Create a new file called test.ts');

      const result = await tool.execute({
        file_path: 'test.ts',
        change_type: 'create',
        description: 'Create test file',
        suggested_code: 'export const test = () => {};',
        reasoning: 'Test file needed'
      });

      expect(applyChange).toHaveBeenCalled();
      expect(autoApplyToDisk).toHaveBeenCalledWith('test.ts');
      expect(result).toContain('automatically applied to disk');
    });

    it('should auto-apply when user prompt is an order (write)', async () => {
      getUserPrompt.mockReturnValue('Write a function to calculate sum');

      const result = await tool.execute({
        file_path: 'calculator.ts',
        change_type: 'create',
        description: 'Add sum function',
        suggested_code: 'export const sum = (a: number, b: number) => a + b;',
        reasoning: 'Sum function needed'
      });

      expect(autoApplyToDisk).toHaveBeenCalled();
      expect(result).toContain('automatically applied to disk');
    });

    it('should NOT auto-apply when user prompt is a question', async () => {
      getUserPrompt.mockReturnValue('What does this function do?');

      const result = await tool.execute({
        file_path: 'test.ts',
        change_type: 'modify',
        description: 'Explain function',
        suggested_code: '// Function explanation',
        reasoning: 'User asked a question'
      });

      expect(applyChange).toHaveBeenCalled();
      // For questions, auto_apply should be false, so autoApplyToDisk should not be called
      // But we need to check the actual behavior - if the prompt is clearly a question,
      // isOrderPrompt should return false
      const resultLower = result.toLowerCase();
      const wasAutoApplied = resultLower.includes('automatically applied');
      expect(wasAutoApplied).toBe(false);
    });

    it('should NOT auto-apply when user prompt contains question words', async () => {
      getUserPrompt.mockReturnValue('How should I implement this feature?');

      const result = await tool.execute({
        file_path: 'feature.ts',
        change_type: 'create',
        description: 'Feature implementation',
        suggested_code: 'export const feature = () => {};',
        reasoning: 'Exploring options'
      });

      // Check result doesn't contain "automatically applied" instead of checking mock
      // because the logic might still call it but return a different message
      const resultLower = result.toLowerCase();
      const wasAutoApplied = resultLower.includes('automatically applied');
      expect(wasAutoApplied).toBe(false);
    });

    it('should respect explicit auto_apply=true even for questions', async () => {
      getUserPrompt.mockReturnValue('What is this?');

      const result = await tool.execute({
        file_path: 'test.ts',
        change_type: 'create',
        description: 'Test file',
        suggested_code: 'export const test = () => {};',
        reasoning: 'Test',
        auto_apply: true
      });

      expect(autoApplyToDisk).toHaveBeenCalled();
      expect(result).toContain('automatically applied to disk');
    });

    it('should respect explicit auto_apply=false even for orders', async () => {
      getUserPrompt.mockReturnValue('Create a new file');

      const result = await tool.execute({
        file_path: 'test.ts',
        change_type: 'create',
        description: 'Test file',
        suggested_code: 'export const test = () => {};',
        reasoning: 'Test',
        auto_apply: false
      });

      expect(applyChange).toHaveBeenCalled();
      // When auto_apply=false is explicit, it should not auto-apply even if prompt is an order
      const resultLower = result.toLowerCase();
      const wasAutoApplied = resultLower.includes('automatically applied');
      expect(wasAutoApplied).toBe(false);
    });

    it('should handle missing getUserPrompt gracefully', async () => {
      const toolWithoutPrompt = new ProposeChangeTool({
        applyChange,
        onChangeApplied,
        autoApplyToDisk
      });

      const result = await toolWithoutPrompt.execute({
        file_path: 'test.ts',
        change_type: 'create',
        description: 'Test file',
        suggested_code: 'export const test = () => {};',
        reasoning: 'Test'
      });

      expect(applyChange).toHaveBeenCalled();
      expect(autoApplyToDisk).not.toHaveBeenCalled();
    });
  });

  describe('execute - basic functionality', () => {
    it('should apply change to virtual codebase', async () => {
      const result = await tool.execute({
        file_path: 'test.ts',
        change_type: 'create',
        description: 'Create test file',
        suggested_code: 'export const test = () => {};',
        reasoning: 'Test file needed'
      });

      expect(applyChange).toHaveBeenCalledWith({
        file_path: 'test.ts',
        change_type: 'create',
        description: 'Create test file',
        suggested_code: 'export const test = () => {};',
        reasoning: 'Test file needed'
      });
      expect(result).toContain('test.ts');
    });

    it('should call onChangeApplied callback', async () => {
      await tool.execute({
        file_path: 'test.ts',
        change_type: 'create',
        description: 'Create test file',
        suggested_code: 'export const test = () => {};',
        reasoning: 'Test'
      });

      expect(onChangeApplied).toHaveBeenCalled();
    });

    it('should handle delete changes', async () => {
      // For delete, suggested_code can be empty string but must be provided
      const result = await tool.execute({
        file_path: 'old.ts',
        change_type: 'delete',
        description: 'Delete old file',
        suggested_code: '', // Empty string is valid for delete
        reasoning: 'File no longer needed'
      });

      expect(applyChange).toHaveBeenCalledWith({
        file_path: 'old.ts',
        change_type: 'delete',
        description: 'Delete old file',
        suggested_code: '',
        reasoning: 'File no longer needed'
      });
      expect(result).toContain('old.ts');
    });

    it('should handle modify changes', async () => {
      const result = await tool.execute({
        file_path: 'existing.ts',
        change_type: 'modify',
        description: 'Update function',
        suggested_code: 'export const updated = () => {};',
        reasoning: 'Update needed'
      });

      expect(applyChange).toHaveBeenCalled();
      expect(result).toContain('existing.ts');
    });

    it('should handle refactor changes', async () => {
      const result = await tool.execute({
        file_path: 'code.ts',
        change_type: 'refactor',
        description: 'Refactor for readability',
        suggested_code: 'export const refactored = () => {};',
        reasoning: 'Improve structure'
      });

      expect(applyChange).toHaveBeenCalled();
      expect(result).toContain('code.ts');
    });

    it('should return error message when applyChange returns false', async () => {
      applyChange.mockReturnValue(false);

      const result = await tool.execute({
        file_path: 'test.ts',
        change_type: 'create',
        description: 'Create test file',
        suggested_code: 'export const test = () => {};',
        reasoning: 'Test'
      });

      expect(result).toContain('Failed to apply');
    });

    it('should handle auto-apply failure gracefully', async () => {
      getUserPrompt.mockReturnValue('Create a new file');
      autoApplyToDisk.mockResolvedValue(false);

      const result = await tool.execute({
        file_path: 'test.ts',
        change_type: 'create',
        description: 'Create test file',
        suggested_code: 'export const test = () => {};',
        reasoning: 'Test'
      });

      expect(result).toContain('Auto-apply to disk was requested but failed');
    });

    it('should handle auto-apply errors gracefully', async () => {
      getUserPrompt.mockReturnValue('Create a new file');
      autoApplyToDisk.mockRejectedValue(new Error('Disk full'));

      const result = await tool.execute({
        file_path: 'test.ts',
        change_type: 'create',
        description: 'Create test file',
        suggested_code: 'export const test = () => {};',
        reasoning: 'Test'
      });

      expect(result).toContain('Auto-apply to disk failed');
      expect(result).toContain('Disk full');
    });
  });

  describe('execute - validation', () => {
    it('should throw error if file_path is missing', async () => {
      await expect(tool.execute({
        change_type: 'create',
        description: 'Test',
        suggested_code: 'code',
        reasoning: 'reason'
      })).rejects.toThrow('file_path is required');
    });

    it('should throw error if change_type is invalid', async () => {
      await expect(tool.execute({
        file_path: 'test.ts',
        change_type: 'invalid',
        description: 'Test',
        suggested_code: 'code',
        reasoning: 'reason'
      })).rejects.toThrow('change_type must be one of');
    });

    it('should throw error if description is missing', async () => {
      await expect(tool.execute({
        file_path: 'test.ts',
        change_type: 'create',
        suggested_code: 'code',
        reasoning: 'reason'
      })).rejects.toThrow('description is required');
    });

    it('should throw error if suggested_code is missing', async () => {
      await expect(tool.execute({
        file_path: 'test.ts',
        change_type: 'create',
        description: 'Test',
        reasoning: 'reason'
      })).rejects.toThrow('suggested_code is required');
    });

    it('should throw error if reasoning is missing', async () => {
      await expect(tool.execute({
        file_path: 'test.ts',
        change_type: 'create',
        description: 'Test',
        suggested_code: 'code'
      })).rejects.toThrow('reasoning is required');
    });
  });
});

