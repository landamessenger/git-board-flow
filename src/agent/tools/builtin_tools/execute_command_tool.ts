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
    
**IMPORTANT**: Commands are executed in the working directory (copilot_dummy by default) unless you specify a different working_directory. This prevents accidentally affecting the main project.

You can use common Unix commands like:
- grep, tail, head, cat, ls, find - for file operations
- npm test, npm run build, npm run lint - for Node.js projects
- git status, git diff - for version control
- Any other shell command available in the system

The output will be captured and returned. Use this to verify that changes are correct before applying them.

**Always specify working_directory explicitly if you need to run commands in a specific location, otherwise they will run in the working directory.**`;
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
          description: 'Working directory to execute the command in (default: working directory like copilot_dummy, NOT the project root). Always specify this explicitly to ensure commands run in the correct location.'
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
    const command = input.command as string;
    const workingDir = input.working_directory || this.options.getWorkingDirectory?.() || process.cwd();
    const extractLines = input.extract_lines as {
      head?: number;
      tail?: number;
      grep?: string;
    } | undefined;

    if (!command || typeof command !== 'string') {
      throw new Error('command is required and must be a string');
    }

    logInfo(`   🔧 Executing command: ${command}`);
    if (workingDir) {
      logInfo(`      Working directory: ${workingDir}`);
    }

    try {
      // Execute command
      const output = execSync(command, {
        cwd: workingDir,
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

