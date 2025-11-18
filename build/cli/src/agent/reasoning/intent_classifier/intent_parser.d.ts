/**
 * Intent Parser
 * Parses intent classification from agent results
 * Only uses structured format from report_intent tool - no text parsing
 */
import { AgentResult } from '../../types';
import { IntentClassificationResult } from './types';
export declare class IntentParser {
    /**
     * Parse intent classification from agent result
     * Only uses structured format from report_intent tool - no text parsing
     * The tool already validates and cleans the data, so we just extract it directly
     */
    static parseIntent(result: AgentResult): IntentClassificationResult;
}
