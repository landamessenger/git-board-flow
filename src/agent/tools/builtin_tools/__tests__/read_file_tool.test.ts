/**
 * Tests for Read File Tool
 */

import { ReadFileTool } from '../read_file_tool';

describe('ReadFileTool', () => {
  let tool: ReadFileTool;
  let getFileContent: jest.Mock;
  let repositoryFiles: Map<string, string>;

  beforeEach(() => {
    getFileContent = jest.fn();
    repositoryFiles = new Map([
      ['src/utils.ts', 'export function util() {}'],
      ['src/helper.ts', 'export function helper() {}']
    ]);
    tool = new ReadFileTool({
      getFileContent,
      repositoryFiles
    });
  });

  describe('getName', () => {
    it('should return correct tool name', () => {
      expect(tool.getName()).toBe('read_file');
    });
  });

  describe('getDescription', () => {
    it('should return description', () => {
      const description = tool.getDescription();
      expect(description).toBeDefined();
      expect(typeof description).toBe('string');
      expect(description.length).toBeGreaterThan(0);
      expect(description).toContain('file');
    });
  });

  describe('getInputSchema', () => {
    it('should return valid input schema', () => {
      const schema = tool.getInputSchema();
      expect(schema).toBeDefined();
      expect(schema.type).toBe('object');
      expect(schema.properties).toBeDefined();
      expect(schema.required).toContain('file_path');
    });

    it('should have file_path field', () => {
      const schema = tool.getInputSchema();
      expect(schema.properties.file_path.type).toBe('string');
    });
  });

  describe('execute', () => {
    it('should read file from virtual codebase first', async () => {
      getFileContent.mockReturnValue('virtual content');
      
      const result = await tool.execute({
        file_path: 'src/utils.ts'
      });

      expect(getFileContent).toHaveBeenCalledWith('src/utils.ts');
      expect(result).toContain('virtual content');
      expect(result).toContain('File: src/utils.ts');
    });

    it('should fall back to repository files if not in virtual codebase', async () => {
      getFileContent.mockReturnValue(undefined);
      
      const result = await tool.execute({
        file_path: 'src/utils.ts'
      });

      expect(getFileContent).toHaveBeenCalledWith('src/utils.ts');
      expect(result).toContain('export function util() {}');
      expect(result).toContain('File: src/utils.ts');
    });

    it('should return error if file not found in either location', async () => {
      getFileContent.mockReturnValue(undefined);
      
      const result = await tool.execute({
        file_path: 'nonexistent.ts'
      });

      expect(result).toContain('Error: File "nonexistent.ts" not found');
    });

    it('should format response with file path and line count', async () => {
      getFileContent.mockReturnValue('line 1\nline 2\nline 3');
      
      const result = await tool.execute({
        file_path: 'src/utils.ts'
      });

      expect(result).toContain('File: src/utils.ts');
      expect(result).toContain('Lines: 3');
      expect(result).toContain('```');
    });

    it('should throw error if file_path is missing', async () => {
      await expect(tool.execute({})).rejects.toThrow('file_path is required');
    });

    it('should throw error if file_path is not a string', async () => {
      await expect(tool.execute({
        file_path: 123
      })).rejects.toThrow('file_path is required');
    });

    it('should handle empty file content', async () => {
      getFileContent.mockReturnValue('');
      repositoryFiles.set('empty.ts', '');
      
      const result = await tool.execute({
        file_path: 'empty.ts'
      });

      expect(result).toContain('File: empty.ts');
      expect(result).toContain('Lines: 1'); // Empty string has 1 line
    });

    it('should work without repositoryFiles', async () => {
      const toolWithoutRepo = new ReadFileTool({
        getFileContent: jest.fn().mockReturnValue('content')
      });
      
      const result = await toolWithoutRepo.execute({
        file_path: 'test.ts'
      });

      expect(result).toContain('content');
    });
  });
});

