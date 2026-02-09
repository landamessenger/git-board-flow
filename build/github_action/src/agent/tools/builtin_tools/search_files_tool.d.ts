/**
 * Search Files Tool - Searches for files by name or content.
 *
 * This tool allows agents to search for files in the repository by name, path, or content
 * keywords. It returns a list of matching file paths, with optional result limiting for
 * efficiency.
 *
 * @internal
 * This tool is used by agents to find files during their reasoning process. It delegates
 * the actual search logic to the searchFiles callback, which can implement various search
 * strategies (name matching, path patterns, content search, etc.).
 *
 * @remarks
 * - query is required and can be a file name, path pattern, or content keyword
 * - max_results defaults to 1000 but can be set higher (>= 10000 returns all results)
 * - Results are formatted as a numbered list for easy reading
 * - Returns empty message if no files match the query
 *
 * @example
 * ```typescript
 * const tool = new SearchFilesTool({
 *   searchFiles: (query) => {
 *     // Implement search logic
 *     return ['src/utils.ts', 'src/helper.ts'];
 *   }
 * });
 *
 * // Search with default limit
 * await tool.execute({ query: 'utils' });
 *
 * // Search with custom limit
 * await tool.execute({ query: 'test', max_results: 5000 });
 * ```
 */
import { BaseTool } from '../base_tool';
/**
 * Options for configuring the SearchFilesTool.
 *
 * @internal
 * These callbacks connect the tool to the file search system, allowing various search
 * strategies to be implemented.
 *
 * @property searchFiles - Callback to perform file search. Returns array of matching file paths.
 * @property getAllFiles - Optional callback to get all files (for comprehensive searches).
 */
export interface SearchFilesToolOptions {
    /**
     * Performs file search based on query.
     *
     * @internal
     * This callback implements the actual search logic. It can search by file name, path
     * pattern, content keywords, or any combination. The implementation is flexible and
     * can use various search strategies.
     *
     * @param query - Search query (file name, path pattern, or content keyword)
     * @returns Array of matching file paths
     */
    searchFiles: (query: string) => string[];
    /**
     * Optional callback to get all files.
     *
     * @internal
     * This callback can be used for comprehensive searches when max_results is very high
     * (>= 10000). It returns all files in the repository.
     *
     * @returns Array of all file paths
     */
    getAllFiles?: () => string[];
}
/**
 * SearchFilesTool - Tool for searching files by name or content.
 *
 * This tool provides a unified interface for file searching, with result limiting and
 * formatting capabilities.
 *
 * @internal
 * The tool validates the query, delegates search to the callback, limits results if needed,
 * and formats the response as a numbered list. For very large max_results (>= 10000), it
 * returns all results without limiting.
 */
export declare class SearchFilesTool extends BaseTool {
    private options;
    /**
     * Creates a new SearchFilesTool instance.
     *
     * @internal
     * The options parameter provides callbacks that implement the search logic.
     *
     * @param options - Configuration object with callbacks for file search
     */
    constructor(options: SearchFilesToolOptions);
    /**
     * Returns the tool name used by the agent system.
     *
     * @internal
     * This name is used when the agent calls the tool via tool calls.
     *
     * @returns Tool identifier: 'search_files'
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
     * This method performs a file search based on the query, limits results if needed, and
     * formats the response as a numbered list.
     *
     * @internal
     * The method performs the following steps:
     * 1. Validates query is provided and is a string
     * 2. Validates max_results is at least 1
     * 3. Delegates search to searchFiles callback
     * 4. Limits results if max_results is reasonable (< 10000)
     * 5. Formats results as numbered list or returns empty message
     *
     * @param input - Tool input containing query and optional max_results
     * @returns Formatted string with numbered list of matching files, or empty message if none found
     *
     * @throws Error if query is missing or not a string, or if max_results is less than 1
     *
     * @remarks
     * - max_results defaults to 1000 for comprehensive searches
     * - For max_results >= 10000, all results are returned (no limiting)
     * - Results are formatted as a numbered list for easy reading
     * - Returns empty message (not exception) if no files match
     *
     * @example
     * ```typescript
     * // Search with default limit
     * const result = await tool.execute({ query: 'utils' });
     * // Returns: "Found 2 file(s) matching "utils":\n\n1. src/utils.ts\n2. src/utils/helper.ts"
     *
     * // Search with custom limit
     * const result2 = await tool.execute({ query: 'test', max_results: 5000 });
     *
     * // No results
     * const result3 = await tool.execute({ query: 'nonexistent' });
     * // Returns: "No files found matching query: "nonexistent""
     * ```
     */
    execute(input: Record<string, unknown>): Promise<string>;
}
