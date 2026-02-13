/**
 * Prompt for recommending implementation steps from an issue (RecommendStepsUseCase).
 */
import { fillTemplate } from './fill';

const TEMPLATE = `Based on the following issue description, recommend concrete steps to implement or address this issue. Order the steps logically (e.g. setup, implementation, tests, docs). Keep each step clear and actionable.

{{projectContextInstruction}}

**Issue #{{issueNumber}} description:**
{{issueDescription}}

Provide a numbered list of recommended steps in **markdown** (use headings, lists, code blocks for commands or snippets) so it is easy to read. You can add brief sub-bullets per step if needed.`;

export type RecommendStepsParams = {
    projectContextInstruction: string;
    issueNumber: string;
    issueDescription: string;
};

export function getRecommendStepsPrompt(params: RecommendStepsParams): string {
    return fillTemplate(TEMPLATE, {
        projectContextInstruction: params.projectContextInstruction,
        issueNumber: String(params.issueNumber),
        issueDescription: params.issueDescription,
    });
}
