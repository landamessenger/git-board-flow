/**
 * Propose Change Tool
 * Proposes changes to files in the virtual codebase
 */
import { BaseTool } from '../base_tool';
export type ChangeType = 'create' | 'modify' | 'delete' | 'refactor';
export interface ProposeChangeToolOptions {
    applyChange: (change: {
        file_path: string;
        change_type: ChangeType;
        description: string;
        suggested_code: string;
        reasoning: string;
    }) => boolean;
    onChangeApplied?: (change: any) => void;
    autoApplyToDisk?: (filePath: string, operation?: 'create' | 'modify' | 'delete' | 'refactor') => Promise<boolean>;
    getUserPrompt?: () => string | undefined;
    getShouldApplyChanges?: () => boolean | undefined;
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
    /**
     * Detect if user prompt is an order (not a question)
     */
    private isOrderPrompt;
    execute(input: Record<string, any>): Promise<string>;
}
