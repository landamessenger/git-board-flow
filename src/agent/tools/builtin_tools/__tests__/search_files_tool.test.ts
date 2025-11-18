/**
 * Tests for Search Files Tool
 */

import { SearchFilesTool } from '../search_files_tool';

describe('SearchFilesTool', () => {
  let tool: SearchFilesTool;
  let searchFiles: jest.Mock;

  beforeEach(() => {
    searchFiles = jest.fn();
    tool = new SearchFilesTool({
      searchFiles
    });
  });

  describe('getName', () => {
    it('should return correct tool name', () => {
      expect(tool.getName()).toBe('search_files');
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
      expect(schema.required).toContain('query');
    });

    it('should have query field', () => {
      const schema = tool.getInputSchema();
      expect(schema.properties.query.type).toBe('string');
    });

    it('should have max_results field', () => {
      const schema = tool.getInputSchema();
      expect(schema.properties.max_results.type).toBe('number');
    });
  });

  describe('execute', () => {
    it('should search files with valid query', async () => {
      searchFiles.mockReturnValue(['src/utils.ts', 'src/utils/helper.ts']);
      
      const result = await tool.execute({
        query: 'utils'
      });

      expect(searchFiles).toHaveBeenCalledWith('utils');
      expect(result).toContain('Found 2 file(s)');
      expect(result).toContain('src/utils.ts');
      expect(result).toContain('src/utils/helper.ts');
    });

    it('should format results as numbered list', async () => {
      searchFiles.mockReturnValue(['file1.ts', 'file2.ts', 'file3.ts']);
      
      const result = await tool.execute({
        query: 'test'
      });

      expect(result).toContain('1. file1.ts');
      expect(result).toContain('2. file2.ts');
      expect(result).toContain('3. file3.ts');
    });

    it('should return empty message when no files found', async () => {
      searchFiles.mockReturnValue([]);
      
      const result = await tool.execute({
        query: 'nonexistent'
      });

      expect(result).toContain('No files found');
      expect(result).toContain('nonexistent');
    });

    it('should use default max_results of 1000', async () => {
      const manyFiles = Array.from({ length: 2000 }, (_, i) => `file${i}.ts`);
      searchFiles.mockReturnValue(manyFiles);
      
      const result = await tool.execute({
        query: 'test'
      });

      expect(result).toContain('Found 1000 file(s)');
    });

    it('should limit results to max_results', async () => {
      const manyFiles = Array.from({ length: 100 }, (_, i) => `file${i}.ts`);
      searchFiles.mockReturnValue(manyFiles);
      
      const result = await tool.execute({
        query: 'test',
        max_results: 10
      });

      expect(result).toContain('Found 10 file(s)');
    });

    it('should return all results when max_results >= 10000', async () => {
      const manyFiles = Array.from({ length: 5000 }, (_, i) => `file${i}.ts`);
      searchFiles.mockReturnValue(manyFiles);
      
      const result = await tool.execute({
        query: 'test',
        max_results: 10000
      });

      expect(result).toContain('Found 5000 file(s)');
    });

    it('should throw error if query is missing', async () => {
      await expect(tool.execute({})).rejects.toThrow('query is required');
    });

    it('should throw error if query is not a string', async () => {
      await expect(tool.execute({
        query: 123
      })).rejects.toThrow('query is required');
    });

    it('should throw error if max_results is less than 1', async () => {
      await expect(tool.execute({
        query: 'test',
        max_results: 0
      })).rejects.toThrow('max_results must be at least 1');
    });

    it('should handle single result', async () => {
      searchFiles.mockReturnValue(['single.ts']);
      
      const result = await tool.execute({
        query: 'single'
      });

      expect(result).toContain('Found 1 file(s)');
      expect(result).toContain('1. single.ts');
    });
  });
});

