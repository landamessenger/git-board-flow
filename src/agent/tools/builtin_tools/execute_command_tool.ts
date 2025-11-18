/**
 * Execute Command Tool - Executes shell commands and returns their output.
 * 
 * This tool allows agents to execute shell commands to verify code, run tests, compile,
 * lint, or perform other operations. Commands are automatically executed in the working
 * directory to ensure they run in the correct location.
 * 
 * @internal
 * This tool is used by agents to verify changes, run tests, and perform other verification
 * tasks. It includes automatic working directory handling, output filtering capabilities,
 * and failure detection based on output patterns.
 * 
 * @remarks
 * - Commands are automatically prefixed with 'cd working_directory &&' (if autoCd is enabled)
 * - Supports output filtering (head, tail, grep) for efficiency
 * - Detects failure patterns in output (error, failed, exit code, etc.)
 * - Captures both stdout and stderr
 * - Returns formatted output with command, working directory, exit code, and output
 * 
 * @example
 * ```typescript
 * const tool = new ExecuteCommandTool({
 *   getWorkingDirectory: () => '/project',
 *   onCommandExecuted: (cmd, success, output) => { console.log('Executed:', cmd); }
 * });
 * 
 * // Execute a command
 * await tool.execute({ command: 'npm test' });
 * 
 * // With output filtering
 * await tool.execute({
 *   command: 'npm test',
 *   extract_lines: { head: 50, grep: 'error' }
 * });
 * ```
 */

import { BaseTool } from '../base_tool';
import { execSync } from 'child_process';

/**
 * Options for configuring the ExecuteCommandTool.
 * 
 * @internal
 * These callbacks and options configure command execution behavior and provide hooks
 * for monitoring command execution.
 * 
 * @property getWorkingDirectory - Optional callback to get working directory (default: process.cwd()).
 * @property onCommandExecuted - Optional callback invoked after command execution with results.
 * @property autoCd - If true, automatically prepend cd command (default: true).
 */
export interface ExecuteCommandToolOptions {
  /**
   * Optional callback to get working directory.
   * 
   * @internal
   * This callback returns the working directory where commands should be executed.
   * If not provided, defaults to process.cwd().
   * 
   * @returns Working directory path
   */
  getWorkingDirectory?: () => string;
  
  /**
   * Optional callback invoked after command execution.
   * 
   * @internal
   * This callback is invoked after each command execution with the command, success status,
   * and output. Useful for logging or monitoring command execution.
   * 
   * @param command - The executed command
   * @param success - Whether command succeeded (based on exit code and output patterns)
   * @param output - Command output (stdout/stderr)
   */
  onCommandExecuted?: (command: string, success: boolean, output: string) => void;
  
  /**
   * If true, automatically prepend cd command (default: true).
   * 
   * @internal
   * When enabled, commands are automatically prefixed with 'cd working_directory &&' to
   * ensure they run in the correct directory. This is useful when working directory differs
   * from process.cwd().
   */
  autoCd?: boolean;
}

/**
 * ExecuteCommandTool - Tool for executing shell commands and returning their output.
 * 
 * This tool provides a safe way to execute shell commands with automatic working directory
 * handling, output filtering, and failure detection.
 * 
 * @internal
 * The tool handles command execution, output capture, filtering, and failure detection.
 * It automatically manages working directory changes and provides formatted output for easy
 * consumption by agents.
 */
export class ExecuteCommandTool extends BaseTool {
  /**
   * Creates a new ExecuteCommandTool instance.
   * 
   * @internal
   * The options parameter provides callbacks and configuration for command execution.
   * 
   * @param options - Configuration object with callbacks and options for command execution
   */
  constructor(private options: ExecuteCommandToolOptions) {
    super();
  }

  /**
   * Returns the tool name used by the agent system.
   * 
   * @internal
   * This name is used when the agent calls the tool via tool calls.
   * 
   * @returns Tool identifier: 'execute_command'
   */
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

  /**
   * Executes the tool with the provided input.
   * 
   * This method executes a shell command, captures its output, applies optional filters,
   * and detects failure patterns. It handles both successful and failed command execution.
   * 
   * @internal
   * The method performs the following steps:
   * 1. Validates command input
   * 2. Automatically prepends 'cd working_directory &&' if autoCd is enabled
   * 3. Executes command with proper working directory and buffer settings
   * 4. Applies output filters (grep, head, tail) if specified
   * 5. Detects failure patterns in output
   * 6. Formats and returns result with command details and output
   * 
   * @param input - Tool input containing command, optional working_directory, and extract_lines
   * @returns Formatted string with command details, exit code, and output
   * 
   * @throws Error if command is missing or not a string
   * 
   * @remarks
   * - Commands are automatically executed in working directory (via autoCd or cwd option)
   * - Output filtering (grep, head, tail) can be combined for efficient result processing
   * - Failure detection uses pattern matching on output (error, failed, exit code, etc.)
   * - Both stdout and stderr are captured
   * - execSync throws on non-zero exit codes, so successful execution means exit code 0
   * - Failed commands return formatted error output with exit code and status
   * 
   * @example
   * ```typescript
   * // Execute a simple command
   * const result = await tool.execute({ command: 'npm test' });
   * 
   * // With output filtering
   * const result2 = await tool.execute({
   *   command: 'npm test',
   *   extract_lines: { head: 50, grep: 'error' }
   * });
   * 
   * // With custom working directory
   * const result3 = await tool.execute({
   *   command: 'ls',
   *   working_directory: '/tmp'
   * });
   * ```
   */
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

    // Validate command is provided and is a string
    // @internal command is required to know what to execute
    if (!command || typeof command !== 'string') {
      throw new Error('command is required and must be a string');
    }

    // Auto-prepend cd if working directory is specified and command doesn't already start with cd
    // @internal This ensures commands run in the correct directory even if process.cwd() differs
    if (autoCd && workingDir && workingDir !== process.cwd() && !command.trim().startsWith('cd ')) {
      // Escape the working directory path for shell
      // @internal Escaping prevents shell injection and handles paths with spaces/special chars
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
      // @internal If cd is prepended to command, we use process.cwd() as cwd since cd handles the directory change
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
      // @internal Output filtering allows agents to focus on relevant parts of command output
      if (extractLines) {
        const lines = result.split('\n');
        let filteredLines = lines;

        // Apply grep filter
        // @internal Filter lines containing the grep pattern (case-insensitive)
        if (extractLines.grep) {
          const pattern = extractLines.grep.toLowerCase();
          filteredLines = filteredLines.filter(line => 
            line.toLowerCase().includes(pattern)
          );
          logInfo(`      Filtered with grep pattern: "${extractLines.grep}" (${filteredLines.length} lines)`);
        }

        // Apply head filter
        // @internal Extract first N lines (like head -N)
        if (extractLines.head && extractLines.head > 0) {
          filteredLines = filteredLines.slice(0, extractLines.head);
          logInfo(`      Extracted first ${extractLines.head} lines`);
        }

        // Apply tail filter
        // @internal Extract last N lines (like tail -N)
        if (extractLines.tail && extractLines.tail > 0) {
          filteredLines = filteredLines.slice(-extractLines.tail);
          logInfo(`      Extracted last ${extractLines.tail} lines`);
        }

        result = filteredLines.join('\n');
      }

      // Check if output indicates failure (common patterns)
      // @internal Pattern matching helps detect failures even when exit code is 0
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
      // @internal Formatted output includes command, working directory, exit code, and output
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
      // Handle command execution failure
      // @internal execSync throws on non-zero exit codes, so we catch and format the error
      const errorOutput = error.stdout?.toString() || error.stderr?.toString() || error.message;
      const exitCode = error.status || error.code || 1;
      
      logError(`   ❌ Command failed with exit code ${exitCode}`);
      
      this.options.onCommandExecuted?.(command, false, errorOutput);

      // Format error result
      // @internal Error output includes command, working directory, exit code, and error details
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

