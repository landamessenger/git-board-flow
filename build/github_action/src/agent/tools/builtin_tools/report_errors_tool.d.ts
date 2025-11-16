/**
 * Report Errors Tool
 * Tool for reporting detected errors in structured format
 */
import { BaseTool } from '../base_tool';
import { DetectedError } from '../../reasoning/error_detector/types';
export interface ReportErrorsToolOptions {
    onErrorsReported: (errors: DetectedError[]) => void;
}
export declare class ReportErrorsTool extends BaseTool {
    private options;
    constructor(options: ReportErrorsToolOptions);
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
