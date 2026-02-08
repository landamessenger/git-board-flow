/**
 * Read File Tool - Reads file contents from repository or virtual codebase.
 *
 * This tool allows agents to read and examine file contents from either the virtual codebase
 * (in-memory changes) or the original repository files. It provides a unified interface for
 * accessing file content regardless of whether the file has been modified in the virtual codebase.
 *
 * @internal
 * This tool is used by agents to examine code, configuration files, or any file in the codebase
 * during their reasoning process. It checks the virtual codebase first (for modified files) and
 * falls back to repository files if not found.
 *
 * @remarks
 * - Virtual codebase is checked first (for files modified via propose_change)
 * - Falls back to repository files if not found in virtual codebase
 * - Returns formatted response with file path, line count, and code block
 * - Returns error message if file is not found in either location
 *
 * @example
 * ```typescript
 * const tool = new ReadFileTool({
 *   getFileContent: (filePath) => { return 'file content'; },
 *   repositoryFiles: new Map([['src/utils.ts', 'export function util() {}']])
 * });
 *
 * const result = await tool.execute({ file_path: 'src/utils.ts' });
 * // Returns: "File: src/utils.ts\nLines: 1\n\n```\nfile content\n```"
 * ```
 */
import { BaseTool } from '../base_tool';
/**
 * Options for configuring the ReadFileTool.
 *
 * @internal
 * These callbacks connect the tool to the virtual codebase and repository file storage.
 *
 * @property getFileContent - Callback to get file content from virtual codebase. Returns content or undefined.
 * @property repositoryFiles - Optional Map of repository file paths to their contents (original files).
 */
export interface ReadFileToolOptions {
    /**
     * Gets file content from virtual codebase.
     *
     * @internal
     * This callback is used to retrieve file content from the in-memory virtual codebase,
     * which contains files that have been modified via propose_change but not yet written to disk.
     *
     * @param filePath - Path to the file to read
     * @returns File content as string, or undefined if file not found in virtual codebase
     */
    getFileContent: (filePath: string) => string | undefined;
    /**
     * Optional Map of repository file paths to their contents.
     *
     * @internal
     * This Map contains the original repository files. It's used as a fallback when
     * a file is not found in the virtual codebase.
     */
    repositoryFiles?: Map<string, string>;
}
/**
 * ReadFileTool - Tool for reading file contents from repository or virtual codebase.
 *
 * This tool provides a unified interface for accessing file content from either the virtual
 * codebase (modified files) or the original repository files.
 *
 * @internal
 * The tool checks the virtual codebase first, then falls back to repository files. This ensures
 * that agents always see the most recent changes (from propose_change) when reading files.
 */
export declare class ReadFileTool extends BaseTool {
    private options;
    /**
     * Creates a new ReadFileTool instance.
     *
     * @internal
     * The options parameter provides callbacks that connect this tool to the virtual codebase
     * and repository file storage.
     *
     * @param options - Configuration object with callbacks for file operations
     */
    constructor(options: ReadFileToolOptions);
    /**
     * Returns the tool name used by the agent system.
     *
     * @internal
     * This name is used when the agent calls the tool via tool calls.
     *
     * @returns Tool identifier: 'read_file'
     */
    getName(): string;
    /**
     * Returns the tool description shown to the agent.
     *
     * @internal
     * This description helps the agent understand when and how to use this tool.
     * It's included in the agent's available tools list.
     *
     * @returns Human-readable description of the tool's purpose
     */
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
     * This method reads file content from either the virtual codebase or repository files.
     * It checks the virtual codebase first (for modified files) and falls back to repository
     * files if not found.
     *
     * @internal
     * The method validates the file_path input and then attempts to retrieve the file content
     * from two sources in order:
     * 1. Virtual codebase (via getFileContent callback) - contains files modified via propose_change
     * 2. Repository files (via repositoryFiles Map) - contains original files
     *
     * @param input - Tool input containing file_path
     * @returns Formatted string with file path, line count, and code block, or error message if file not found
     *
     * @throws Error if file_path is missing or not a string
     *
     * @remarks
     * - Virtual codebase is checked first to ensure agents see the most recent changes
     * - Response format includes file path, line count, and code block for easy reading
     * - Returns error message (not exception) if file is not found in either location
     *
     * @example
     * ```typescript
     * const result = await tool.execute({ file_path: 'src/utils.ts' });
     * // Returns: "File: src/utils.ts\nLines: 10\n\n```\nexport function util() {}\n```"
     *
     * const result2 = await tool.execute({ file_path: 'nonexistent.ts' });
     * // Returns: "Error: File "nonexistent.ts" not found in the repository."
     * ```
     */
    execute(input: Record<string, unknown>): Promise<string>;
}
