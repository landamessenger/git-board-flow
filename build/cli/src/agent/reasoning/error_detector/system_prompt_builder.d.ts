/**
 * System Prompt Builder
 * Builds system prompts for error detection
 */
import { ErrorDetectionOptions } from './types';
export declare class SystemPromptBuilder {
    /**
     * Build system prompt for error detection
     */
    static build(options: ErrorDetectionOptions): string;
}
