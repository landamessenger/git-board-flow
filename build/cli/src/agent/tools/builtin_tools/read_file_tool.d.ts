/**
 * Read File Tool
 * Reads file contents from repository or virtual codebase
 */
import { BaseTool } from '../base_tool';
export interface ReadFileToolOptions {
    getFileContent: (filePath: string) => string | undefined;
    repositoryFiles?: Map<string, string>;
}
export declare class ReadFileTool extends BaseTool {
    private options;
    constructor(options: ReadFileToolOptions);
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
