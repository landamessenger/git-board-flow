/**
 * Search Files Tool
 * Searches for files by name or content
 */
import { BaseTool } from '../base_tool';
export interface SearchFilesToolOptions {
    searchFiles: (query: string) => string[];
    getAllFiles?: () => string[];
}
export declare class SearchFilesTool extends BaseTool {
    private options;
    constructor(options: SearchFilesToolOptions);
    getName(): string;
    getDescription(): string;
    getInputSchema(): {
        type: 'object';
        properties: Record<string, any>;
        required: string[];
        additionalProperties?: boolean;
    };
    execute(input: Record<string, any>): Promise<string>;
}
