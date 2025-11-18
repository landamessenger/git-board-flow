/**
 * Execute Command Tool
 * Executes shell commands and returns their output
 * Useful for running tests, compilation, linting, and other verification tasks
 */

import { BaseTool } from '../base_tool';
import { execSync } from 'child_process';

export interface ExecuteCommandToolOptions {
  getWorkingDirectory?: () => string;
  onCommandExecuted?: (command: string, success: boolean, output: string) => void;
  autoCd?: boolean; // If true, automatically prepend cd command (default: true)
}

export class ExecuteCommandTool extends BaseTool {
  constructor(private options: ExecuteCommandToolOptions) {
    super();
  }

  getName(): string {
    return 'execute_command';
  }

  getDescription(): string {
    return `Execute shell commands to verify code, run tests, compile, lint, or perform other operations. 
    
**IMPORTANT**: Commands are automatically executed with 'cd' to the working directory (current directory by default) to ensure they run in the correct location.

**How it works**:
- Commands are automatically prefixed with 'cd working_directory &&' to ensure execution in the correct directory
- Example: "npm test" becomes "cd <working_directory> && npm test"
- You don't need to manually add 'cd' - it's done automatically

You can use common Unix commands like:
- npm test, npm run build, npm run lint - for Node.js projects
- grep, tail, head, cat, ls, find - for file operations
- git status, git diff - for version control
- Any other shell command available in the system

The output will be captured and returned. Use this to verify that changes are correct after applying them.`;
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
        command: {
          type: 'string',
          description: 'The shell command to execute (e.g., "npm test", "grep -r error src/", "tail -n 50 build.log")'
        },
        working_directory: {
          type: 'string',
          description: 'Working directory to execute the command in (default: current directory). Commands automatically run in the working directory unless specified otherwise.'
        },
        extract_lines: {
          type: 'object',
          properties: {
            head: {
              type: 'number',
              description: 'Extract first N lines from output (like head -N)'
            },
            tail: {
              type: 'number',
              description: 'Extract last N lines from output (like tail -N)'
            },
            grep: {
              type: 'string',
              description: 'Filter lines containing this pattern (like grep pattern)'
            }
          },
          description: 'Optional: Extract specific lines from command output for efficiency'
        }
      },
      required: ['command'],
      additionalProperties: false
    };
  }

  async execute(input: Record<string, any>): Promise<string> {
    const { logInfo, logError, logWarn } = require('../../../utils/logger');
    let command = input.command as string;
    const workingDir = input.working_directory || this.options.getWorkingDirectory?.() || process.cwd();
    const extractLines = input.extract_lines as {
      head?: number;
      tail?: number;
      grep?: string;
    } | undefined;
    const autoCd = this.options.autoCd !== false; // Default to true

    if (!command || typeof command !== 'string') {
      throw new Error('command is required and must be a string');
    }

    // Auto-prepend cd if working directory is specified and command doesn't already start with cd
    if (autoCd && workingDir && workingDir !== process.cwd() && !command.trim().startsWith('cd ')) {
      // Escape the working directory path for shell
      const escapedDir = workingDir.replace(/'/g, "'\\''");
      command = `cd '${escapedDir}' && ${command}`;
      logInfo(`   🔧 Executing command with auto cd: ${command}`);
    } else {
      logInfo(`   🔧 Executing command: ${command}`);
    }
    
    if (workingDir) {
      logInfo(`      Working directory: ${workingDir}`);
    }

    try {
      // Execute command (if autoCd prepended cd, use process.cwd() as cwd since cd is in command)
      const actualCwd = (autoCd && command.startsWith('cd ')) ? process.cwd() : workingDir;
      const output = execSync(command, {
        cwd: actualCwd,
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        stdio: ['pipe', 'pipe', 'pipe'] // Capture stdout and stderr
      });

      let result = output.toString();
      let success = true;

      // Apply extraction filters if specified
      if (extractLines) {
        const lines = result.split('\n');
        let filteredLines = lines;

        // Apply grep filter
        if (extractLines.grep) {
          const pattern = extractLines.grep.toLowerCase();
          filteredLines = filteredLines.filter(line => 
            line.toLowerCase().includes(pattern)
          );
          logInfo(`      Filtered with grep pattern: "${extractLines.grep}" (${filteredLines.length} lines)`);
        }

        // Apply head filter
        if (extractLines.head && extractLines.head > 0) {
          filteredLines = filteredLines.slice(0, extractLines.head);
          logInfo(`      Extracted first ${extractLines.head} lines`);
        }

        // Apply tail filter
        if (extractLines.tail && extractLines.tail > 0) {
          filteredLines = filteredLines.slice(-extractLines.tail);
          logInfo(`      Extracted last ${extractLines.tail} lines`);
        }

        result = filteredLines.join('\n');
      }

      // Check if output indicates failure (common patterns)
      const failurePatterns = [
        /error/i,
        /failed/i,
        /failure/i,
        /✖/,
        /×/,
        /exit code [1-9]/,
        /command failed/i
      ];

      const hasFailure = failurePatterns.some(pattern => pattern.test(result));
      if (hasFailure) {
        logWarn(`   ⚠️  Command output suggests possible failure`);
        success = false;
      } else {
        logInfo(`   ✅ Command executed successfully`);
      }

      this.options.onCommandExecuted?.(command, success, result);

      // Format result
      const exitCode = 0; // execSync throws on non-zero, so if we're here it succeeded
      let formattedResult = `Command: ${command}\n`;
      formattedResult += `Working Directory: ${workingDir}\n`;
      formattedResult += `Exit Code: ${exitCode}\n`;
      formattedResult += `Output:\n${'='.repeat(60)}\n${result}\n${'='.repeat(60)}`;

      if (hasFailure) {
        formattedResult += `\n⚠️  WARNING: Output contains error indicators. Please review and fix if needed.`;
      }

      return formattedResult;
    } catch (error: any) {
      const errorOutput = error.stdout?.toString() || error.stderr?.toString() || error.message;
      const exitCode = error.status || error.code || 1;
      
      logError(`   ❌ Command failed with exit code ${exitCode}`);
      
      this.options.onCommandExecuted?.(command, false, errorOutput);

      // Format error result
      let formattedResult = `Command: ${command}\n`;
      formattedResult += `Working Directory: ${workingDir}\n`;
      formattedResult += `Exit Code: ${exitCode}\n`;
      formattedResult += `Status: FAILED\n`;
      formattedResult += `Error Output:\n${'='.repeat(60)}\n${errorOutput}\n${'='.repeat(60)}`;
      formattedResult += `\n❌ Command execution failed. Please review the error and fix the issue.`;

      return formattedResult;
    }
  }
}

