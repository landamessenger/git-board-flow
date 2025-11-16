/**
 * System Prompt Builder
 * Builds system prompts for progress detection
 */
import { ProgressDetectionOptions } from './types';
export declare class SystemPromptBuilder {
    /**
     * Build system prompt for progress detection
     */
    static build(options: ProgressDetectionOptions): string;
}
