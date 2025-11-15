/**
 * Propose Change Tool
 * Proposes changes to files in the virtual codebase
 */
import { BaseTool } from '../base_tool';
export interface ProposeChangeToolOptions {
    applyChange: (change: {
        file_path: string;
        change_type: 'create' | 'modify' | 'delete' | 'refactor';
        description: string;
        suggested_code: string;
        reasoning: string;
    }) => boolean;
    onChangeApplied?: (change: any) => void;
}
export declare class ProposeChangeTool extends BaseTool {
    private options;
    constructor(options: ProposeChangeToolOptions);
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
