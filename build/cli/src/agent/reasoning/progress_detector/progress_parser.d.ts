/**
 * Progress Parser
 * Parses progress percentage from agent results
 * Only uses structured format from report_progress tool - no text parsing
 */
import { AgentResult } from '../../types';
export declare class ProgressParser {
    /**
     * Parse progress from agent result
     * Only uses structured format from report_progress tool - no text parsing
     * The tool already validates and cleans the data, so we just extract it directly
     */
    static parseProgress(result: AgentResult): {
        progress: number;
        summary: string;
    };
}
