/**
 * Apply Changes Tool
 * Applies proposed changes from the virtual codebase to the actual file system
 * Only applies changes to files within the working directory for safety
 */
import { BaseTool } from '../base_tool';
export interface ApplyChangesToolOptions {
    getVirtualCodebase: () => Map<string, string>;
    getWorkingDirectory: () => string;
    onChangesApplied?: (changes: Array<{
        file: string;
        changeType: string;
    }>) => void;
}
export declare class ApplyChangesTool extends BaseTool {
    private options;
    constructor(options: ApplyChangesToolOptions);
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
