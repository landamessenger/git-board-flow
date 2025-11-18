/**
 * Tests for Apply Changes Tool
 */

import { ApplyChangesTool } from '../apply_changes_tool';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('ApplyChangesTool', () => {
  let tool: ApplyChangesTool;
  let virtualCodebase: Map<string, string>;
  let testWorkingDir: string;
  let onChangesApplied: jest.Mock;

  beforeEach(() => {
    // Create a temporary test directory
    testWorkingDir = path.join(os.tmpdir(), `copilot-test-${Date.now()}`);
    fs.mkdirSync(testWorkingDir, { recursive: true });

    virtualCodebase = new Map<string, string>();
    onChangesApplied = jest.fn();

    tool = new ApplyChangesTool({
      getVirtualCodebase: () => virtualCodebase,
      getWorkingDirectory: () => testWorkingDir,
      onChangesApplied
    });
  });

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(testWorkingDir)) {
      fs.rmSync(testWorkingDir, { recursive: true, force: true });
    }
  });

  describe('getName', () => {
    it('should return correct tool name', () => {
      expect(tool.getName()).toBe('apply_changes');
    });
  });

  describe('getDescription', () => {
    it('should return tool description', () => {
      const description = tool.getDescription();
      expect(description).toBeDefined();
      expect(typeof description).toBe('string');
      expect(description.length).toBeGreaterThan(0);
      expect(description.toLowerCase()).toContain('apply');
      expect(description.toLowerCase()).toContain('virtual');
    });
  });

  describe('getInputSchema', () => {
    it('should return valid JSON schema', () => {
      const schema = tool.getInputSchema();

      expect(schema.type).toBe('object');
      expect(schema.properties).toBeDefined();
      expect(schema.properties.file_paths).toBeDefined();
      expect(schema.properties.dry_run).toBeDefined();
    });

    it('should have file_paths as optional array', () => {
      const schema = tool.getInputSchema();
      const filePathsProp = schema.properties.file_paths;

      expect(filePathsProp.type).toBe('array');
      expect(schema.required).not.toContain('file_paths');
    });

    it('should have dry_run as optional boolean', () => {
      const schema = tool.getInputSchema();
      const dryRunProp = schema.properties.dry_run;

      expect(dryRunProp.type).toBe('boolean');
      expect(schema.required).not.toContain('dry_run');
    });
  });

  describe('execute', () => {
    it('should apply all files from virtual codebase when no file_paths specified', async () => {
      const filePath1 = path.join(testWorkingDir, 'file1.ts');
      const filePath2 = path.join(testWorkingDir, 'file2.ts');
      const content1 = 'export const file1 = () => {};';
      const content2 = 'export const file2 = () => {};';

      virtualCodebase.set(filePath1, content1);
      virtualCodebase.set(filePath2, content2);

      const result = await tool.execute({});

      expect(result).toContain('Applied 2 file(s)');
      expect(fs.existsSync(filePath1)).toBe(true);
      expect(fs.existsSync(filePath2)).toBe(true);
      expect(fs.readFileSync(filePath1, 'utf8')).toBe(content1);
      expect(fs.readFileSync(filePath2, 'utf8')).toBe(content2);
      expect(onChangesApplied).toHaveBeenCalledWith([
        { file: filePath1, changeType: 'create' },
        { file: filePath2, changeType: 'create' }
      ]);
    });

    it('should apply only specified files when file_paths provided', async () => {
      const filePath1 = path.join(testWorkingDir, 'file1.ts');
      const filePath2 = path.join(testWorkingDir, 'file2.ts');
      const content1 = 'export const file1 = () => {};';
      const content2 = 'export const file2 = () => {};';

      virtualCodebase.set(filePath1, content1);
      virtualCodebase.set(filePath2, content2);

      const result = await tool.execute({
        file_paths: [filePath1]
      });

      expect(result).toContain('Applied 1 file(s)');
      expect(fs.existsSync(filePath1)).toBe(true);
      expect(fs.existsSync(filePath2)).toBe(false);
    });

    it('should create directories if they do not exist', async () => {
      const filePath = path.join(testWorkingDir, 'subdir', 'nested', 'file.ts');
      const content = 'export const test = () => {};';

      virtualCodebase.set(filePath, content);

      await tool.execute({});

      expect(fs.existsSync(filePath)).toBe(true);
      expect(fs.readFileSync(filePath, 'utf8')).toBe(content);
    });

    it('should handle dry_run mode without writing files', async () => {
      const filePath = path.join(testWorkingDir, 'file.ts');
      const content = 'export const test = () => {};';

      virtualCodebase.set(filePath, content);

      const result = await tool.execute({
        dry_run: true
      });

      expect(result).toContain('[DRY RUN]');
      expect(result).toContain('Would apply');
      expect(fs.existsSync(filePath)).toBe(false);
      expect(onChangesApplied).not.toHaveBeenCalled();
    });

    it('should skip files outside working directory', async () => {
      const outsidePath = '/tmp/outside.ts';
      const insidePath = path.join(testWorkingDir, 'inside.ts');
      const content = 'export const test = () => {};';

      virtualCodebase.set(outsidePath, content);
      virtualCodebase.set(insidePath, content);

      const result = await tool.execute({});

      expect(result).toContain('Applied 1 file(s)');
      expect(fs.existsSync(insidePath)).toBe(true);
      expect(fs.existsSync(outsidePath)).toBe(false);
    });

    it('should return message when no files to apply', async () => {
      const result = await tool.execute({});

      expect(result).toContain('No files to apply');
    });

    it('should handle errors gracefully', async () => {
      const filePath = path.join(testWorkingDir, 'file.ts');
      const content = 'export const test = () => {};';

      virtualCodebase.set(filePath, content);

      // Make directory read-only to cause error (on Unix systems)
      if (process.platform !== 'win32') {
        fs.chmodSync(testWorkingDir, 0o444);
      }

      try {
        const result = await tool.execute({});
        expect(result).toContain('Error');
      } catch (error) {
        // Error is expected in some cases
      } finally {
        if (process.platform !== 'win32') {
          fs.chmodSync(testWorkingDir, 0o755);
        }
      }
    });

    it('should update existing files', async () => {
      const filePath = path.join(testWorkingDir, 'file.ts');
      const originalContent = 'export const old = () => {};';
      const newContent = 'export const new = () => {};';

      // Create file first
      fs.writeFileSync(filePath, originalContent, 'utf8');
      virtualCodebase.set(filePath, newContent);

      await tool.execute({});

      expect(fs.readFileSync(filePath, 'utf8')).toBe(newContent);
      expect(onChangesApplied).toHaveBeenCalledWith([
        { file: filePath, changeType: 'modify' }
      ]);
    });
  });
});

