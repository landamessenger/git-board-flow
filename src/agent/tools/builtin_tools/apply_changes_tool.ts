/**
 * Apply Changes Tool - Applies proposed changes from the virtual codebase to the actual file system.
 * 
 * This tool writes files from the virtual codebase (in-memory changes) to the actual file system.
 * It only applies changes to files within the working directory for safety, preventing accidental
 * modifications outside the project scope.
 * 
 * @internal
 * This tool is used after propose_change to write changes to disk. It supports both specific
 * file paths and applying all pending changes. The tool includes safety checks to ensure files
 * are within the working directory and handles directory creation automatically.
 * 
 * @remarks
 * - Only applies changes to files within the working directory (safety check)
 * - Supports dry-run mode to preview changes without writing to disk
 * - Automatically creates directories if they don't exist
 * - Can apply specific files or all pending changes
 * - Returns detailed summary of applied changes and any errors
 * 
 * @example
 * ```typescript
 * const tool = new ApplyChangesTool({
 *   getVirtualCodebase: () => new Map([['src/utils.ts', 'export function util() {}']]),
 *   getWorkingDirectory: () => '/project',
 *   onChangesApplied: (changes) => { console.log('Applied:', changes); }
 * });
 * 
 * // Apply all pending changes
 * await tool.execute({});
 * 
 * // Apply specific files
 * await tool.execute({ file_paths: ['src/utils.ts'] });
 * 
 * // Dry run
 * await tool.execute({ dry_run: true });
 * ```
 */

import { BaseTool } from '../base_tool';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Options for configuring the ApplyChangesTool.
 * 
 * @internal
 * These callbacks connect the tool to the virtual codebase and working directory management.
 * 
 * @property getVirtualCodebase - Callback to get the virtual codebase Map (file path -> content).
 * @property getWorkingDirectory - Callback to get the working directory path.
 * @property onChangesApplied - Optional callback invoked when changes are successfully applied to disk.
 */
export interface ApplyChangesToolOptions {
  /**
   * Gets the virtual codebase Map.
   * 
   * @internal
   * This callback returns the in-memory virtual codebase containing files that have been
   * modified via propose_change but not yet written to disk.
   * 
   * @returns Map of file paths to their contents
   */
  getVirtualCodebase: () => Map<string, string>;
  
  /**
   * Gets the working directory path.
   * 
   * @internal
   * This callback returns the working directory where files should be written. Only files
   * within this directory will be applied (safety check).
   * 
   * @returns Working directory path
   */
  getWorkingDirectory: () => string;
  
  /**
   * Optional callback invoked when changes are successfully applied.
   * 
   * @internal
   * This callback is invoked after changes are written to disk (not during dry-run).
   * It receives an array of applied changes with file paths and change types.
   * 
   * @param changes - Array of applied changes with file path and change type
   */
  onChangesApplied?: (changes: Array<{ file: string; changeType: string }>) => void;
}

/**
 * ApplyChangesTool - Tool for applying proposed changes from virtual codebase to file system.
 * 
 * This tool provides a safe way to write files from the virtual codebase to disk. It includes
 * safety checks to ensure files are within the working directory and supports dry-run mode.
 * 
 * @internal
 * The tool validates file paths, creates directories as needed, and handles errors gracefully.
 * It only applies changes to files within the working directory to prevent accidental
 * modifications outside the project scope.
 */
export class ApplyChangesTool extends BaseTool {
  /**
   * Creates a new ApplyChangesTool instance.
   * 
   * @internal
   * The options parameter provides callbacks that connect this tool to the virtual codebase
   * and working directory management.
   * 
   * @param options - Configuration object with callbacks for file operations
   */
  constructor(private options: ApplyChangesToolOptions) {
    super();
  }

  /**
   * Returns the tool name used by the agent system.
   * 
   * @internal
   * This name is used when the agent calls the tool via tool calls.
   * 
   * @returns Tool identifier: 'apply_changes'
   */
  getName(): string {
    return 'apply_changes';
  }

  /**
   * Returns the tool description shown to the agent.
   * 
   * @internal
   * This description helps the agent understand when and how to use this tool.
   * It's included in the agent's available tools list.
   * 
   * @returns Human-readable description of the tool's purpose
   */
  getDescription(): string {
    return 'Apply proposed changes from the virtual codebase to the actual file system. Only applies changes to files within the working directory (current directory by default) for safety. Use this after proposing changes with propose_change to write them to disk.';
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
        file_paths: {
          type: 'array',
          items: {
            type: 'string'
          },
          description: 'Array of file paths to apply. If empty or not provided, applies all pending changes in the virtual codebase that are within the working directory.'
        },
        dry_run: {
          type: 'boolean',
          description: 'If true, shows what would be applied without actually writing to disk (default: false)'
        }
      },
      required: [],
      additionalProperties: false
    };
  }

  /**
   * Executes the tool with the provided input.
   * 
   * This method applies files from the virtual codebase to the file system. It supports
   * applying specific files or all pending changes, and includes a dry-run mode for preview.
   * 
   * @internal
   * The method performs the following steps:
   * 1. Determines which files to apply (specific files or all pending changes)
   * 2. Filters files to only include those within the working directory (safety check)
   * 3. For each file: creates directory if needed, writes file content, or previews in dry-run
   * 4. Collects errors and returns summary of applied changes
   * 
   * @param input - Tool input containing optional file_paths array and dry_run boolean
   * @returns String response with summary of applied changes and any errors
   * 
   * @remarks
   * - Files outside the working directory are skipped with a warning
   * - Directories are created automatically if they don't exist
   * - Dry-run mode shows what would be applied without writing to disk
   * - Errors for individual files don't stop processing of other files
   * - Returns detailed summary including file paths and change types
   * 
   * @example
   * ```typescript
   * // Apply all pending changes
   * const result = await tool.execute({});
   * // Returns: "Applied 2 file(s) to disk:\n  - src/utils.ts (create)\n  - src/helper.ts (modify)"
   * 
   * // Apply specific files
   * const result2 = await tool.execute({ file_paths: ['src/utils.ts'] });
   * 
   * // Dry run
   * const result3 = await tool.execute({ dry_run: true });
   * // Returns: "[DRY RUN] Would apply 2 file(s):\n  - src/utils.ts (create)\n  - src/helper.ts (modify)"
   * ```
   */
  async execute(input: Record<string, any>): Promise<string> {
    const { logInfo, logWarn, logError } = require('../../../utils/logger');
    const filePaths = input.file_paths as string[] | undefined;
    const dryRun = input.dry_run === true;
    
    const virtualCodebase = this.options.getVirtualCodebase();
    const workingDir = this.options.getWorkingDirectory();
    
    // Get files to apply
    // @internal Determines which files to process: specific files or all pending changes
    let filesToApply: string[] = [];
    
    if (filePaths && filePaths.length > 0) {
      // Apply specific files
      // @internal Filter to only include files within working directory (safety check)
      filesToApply = filePaths.filter(filePath => {
        const isInWorkingDir = filePath.startsWith(workingDir + '/') || filePath.startsWith(workingDir + '\\');
        if (!isInWorkingDir) {
          logWarn(`⚠️  Skipping ${filePath} - outside working directory (${workingDir})`);
        }
        return isInWorkingDir;
      });
    } else {
      // Apply all files in virtual codebase that are in working directory
      // @internal Iterate through all files in virtual codebase and filter by working directory
      for (const filePath of virtualCodebase.keys()) {
        const isInWorkingDir = filePath.startsWith(workingDir + '/') || filePath.startsWith(workingDir + '\\');
        if (isInWorkingDir) {
          filesToApply.push(filePath);
        }
      }
    }
    
    // Return early if no files to apply
    // @internal Prevents unnecessary processing when no files match criteria
    if (filesToApply.length === 0) {
      return 'No files to apply. Make sure files are within the working directory and have been proposed with propose_change first.';
    }
    
    const appliedChanges: Array<{ file: string; changeType: string }> = [];
    const errors: string[] = [];
    
    // Process each file
    // @internal Each file is processed individually so errors don't stop other files
    for (const filePath of filesToApply) {
      try {
        const content = virtualCodebase.get(filePath);
        if (!content) {
          errors.push(`${filePath}: Not found in virtual codebase`);
          continue;
        }
        
        const fullPath = path.resolve(filePath);
        const dir = path.dirname(fullPath);
        const exists = fs.existsSync(fullPath);
        
        if (dryRun) {
          // Dry run: just log what would be done
          // @internal Dry run mode allows previewing changes without writing to disk
          logInfo(`   🔍 [DRY RUN] Would ${exists ? 'update' : 'create'}: ${filePath}`);
          appliedChanges.push({
            file: filePath,
            changeType: exists ? 'modify' : 'create'
          });
        } else {
          // Ensure directory exists
          // @internal Create directory structure if it doesn't exist
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            logInfo(`📁 Created directory: ${dir}`);
          }
          
          // Write file
          // @internal Write file content to disk
          fs.writeFileSync(fullPath, content, 'utf8');
          logInfo(`💾 Applied change: ${filePath} (${exists ? 'updated' : 'created'})`);
          
          appliedChanges.push({
            file: filePath,
            changeType: exists ? 'modify' : 'create'
          });
        }
      } catch (error: any) {
        // Handle errors for individual files
        // @internal Errors for one file don't stop processing of other files
        const errorMsg = `Error applying ${filePath}: ${error.message}`;
        logError(`❌ ${errorMsg}`);
        errors.push(errorMsg);
      }
    }
    
    // Notify callback if changes were applied (not dry run)
    // @internal Callback is only invoked for actual changes, not dry runs
    if (!dryRun && appliedChanges.length > 0) {
      this.options.onChangesApplied?.(appliedChanges);
    }
    
    // Format result summary
    // @internal Summary includes count, file paths, change types, and any errors
    let result = dryRun 
      ? `[DRY RUN] Would apply ${appliedChanges.length} file(s):\n`
      : `Applied ${appliedChanges.length} file(s) to disk:\n`;
    
    appliedChanges.forEach(change => {
      result += `  - ${change.file} (${change.changeType})\n`;
    });
    
    if (errors.length > 0) {
      result += `\nErrors:\n`;
      errors.forEach(error => {
        result += `  - ${error}\n`;
      });
    }
    
    return result.trim();
  }
}
