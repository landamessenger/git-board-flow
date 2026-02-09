/**
 * System Prompt Builder
 * Builds system prompts for Copilot agent
 */
import { CopilotOptions } from './types';
export declare class SystemPromptBuilder {
    /**
     * Build system prompt for Copilot agent
     */
    static build(options: CopilotOptions): string;
}
