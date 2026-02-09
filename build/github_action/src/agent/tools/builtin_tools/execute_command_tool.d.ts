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
export declare class ExecuteCommandTool extends BaseTool {
    private options;
    /**
     * Creates a new ExecuteCommandTool instance.
     *
     * @internal
     * The options parameter provides callbacks and configuration for command execution.
     *
     * @param options - Configuration object with callbacks and options for command execution
     */
    constructor(options: ExecuteCommandToolOptions);
    /**
     * Returns the tool name used by the agent system.
     *
     * @internal
     * This name is used when the agent calls the tool via tool calls.
     *
     * @returns Tool identifier: 'execute_command'
     */
    getName(): string;
    getDescription(): string;
    getInputSchema(): {
        type: 'object';
        properties: Record<string, any>;
        required: string[];
        additionalProperties?: boolean;
    };
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
    execute(input: Record<string, unknown>): Promise<string>;
}
