/**
 * Prompt for CLI "copilot do" command: project context + user prompt.
 */
import { fillTemplate } from './fill';

const TEMPLATE = `{{projectContextInstruction}}

{{userPrompt}}`;

export type CliDoParams = {
    projectContextInstruction: string;
    userPrompt: string;
};

export function getCliDoPrompt(params: CliDoParams): string {
    return fillTemplate(TEMPLATE, params);
}
