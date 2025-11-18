/**
 * Execute Command Tool
 * Executes shell commands and returns their output
 * Useful for running tests, compilation, linting, and other verification tasks
 */
import { BaseTool } from '../base_tool';
export interface ExecuteCommandToolOptions {
    getWorkingDirectory?: () => string;
    onCommandExecuted?: (command: string, success: boolean, output: string) => void;
    autoCd?: boolean;
}
export declare class ExecuteCommandTool extends BaseTool {
    private options;
    constructor(options: ExecuteCommandToolOptions);
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
