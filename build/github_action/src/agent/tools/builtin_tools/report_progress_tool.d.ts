/**
 * Report Progress Tool
 * Tool for reporting task progress in structured format
 */
import { BaseTool } from '../base_tool';
export interface ReportProgressToolOptions {
    onProgressReported: (progress: number, summary: string) => void;
}
export declare class ReportProgressTool extends BaseTool {
    private options;
    constructor(options: ReportProgressToolOptions);
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
