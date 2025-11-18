/**
 * Report Intent Tool
 * Tool for reporting intent classification decision in structured format
 */
import { BaseTool } from '../base_tool';
export interface ReportIntentToolOptions {
    onIntentReported: (shouldApplyChanges: boolean, reasoning: string, confidence: 'high' | 'medium' | 'low') => void;
}
export declare class ReportIntentTool extends BaseTool {
    private options;
    constructor(options: ReportIntentToolOptions);
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
