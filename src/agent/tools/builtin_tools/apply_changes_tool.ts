/**
 * Apply Changes Tool
 * Applies proposed changes from the virtual codebase to the actual file system
 * Only applies changes to files within the working directory for safety
 */

import { BaseTool } from '../base_tool';
import * as fs from 'fs';
import * as path from 'path';

export interface ApplyChangesToolOptions {
  getVirtualCodebase: () => Map<string, string>;
  getWorkingDirectory: () => string;
  onChangesApplied?: (changes: Array<{ file: string; changeType: string }>) => void;
}

export class ApplyChangesTool extends BaseTool {
  constructor(private options: ApplyChangesToolOptions) {
    super();
  }

  getName(): string {
    return 'apply_changes';
  }

  getDescription(): string {
    return 'Apply proposed changes from the virtual codebase to the actual file system. Only applies changes to files within the working directory (copilot_dummy by default) for safety. Use this after proposing changes with propose_change to write them to disk.';
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

  async execute(input: Record<string, any>): Promise<string> {
    const { logInfo, logWarn, logError } = require('../../../utils/logger');
    const filePaths = input.file_paths as string[] | undefined;
    const dryRun = input.dry_run === true;
    
    const virtualCodebase = this.options.getVirtualCodebase();
    const workingDir = this.options.getWorkingDirectory();
    
    // Get files to apply
    let filesToApply: string[] = [];
    
    if (filePaths && filePaths.length > 0) {
      // Apply specific files
      filesToApply = filePaths.filter(filePath => {
        const isInWorkingDir = filePath.startsWith(workingDir + '/') || filePath.startsWith(workingDir + '\\');
        if (!isInWorkingDir) {
          logWarn(`⚠️  Skipping ${filePath} - outside working directory (${workingDir})`);
        }
        return isInWorkingDir;
      });
    } else {
      // Apply all files in virtual codebase that are in working directory
      for (const filePath of virtualCodebase.keys()) {
        const isInWorkingDir = filePath.startsWith(workingDir + '/') || filePath.startsWith(workingDir + '\\');
        if (isInWorkingDir) {
          filesToApply.push(filePath);
        }
      }
    }
    
    if (filesToApply.length === 0) {
      return 'No files to apply. Make sure files are within the working directory and have been proposed with propose_change first.';
    }
    
    const appliedChanges: Array<{ file: string; changeType: string }> = [];
    const errors: string[] = [];
    
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
          logInfo(`   🔍 [DRY RUN] Would ${exists ? 'update' : 'create'}: ${filePath}`);
          appliedChanges.push({
            file: filePath,
            changeType: exists ? 'modify' : 'create'
          });
        } else {
          // Ensure directory exists
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            logInfo(`📁 Created directory: ${dir}`);
          }
          
          // Write file
          fs.writeFileSync(fullPath, content, 'utf8');
          logInfo(`💾 Applied change: ${filePath} (${exists ? 'updated' : 'created'})`);
          
          appliedChanges.push({
            file: filePath,
            changeType: exists ? 'modify' : 'create'
          });
        }
      } catch (error: any) {
        const errorMsg = `Error applying ${filePath}: ${error.message}`;
        logError(`❌ ${errorMsg}`);
        errors.push(errorMsg);
      }
    }
    
    if (!dryRun && appliedChanges.length > 0) {
      this.options.onChangesApplied?.(appliedChanges);
    }
    
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

