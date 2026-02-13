/**
 * Prompt for assessing issue progress from branch diff (CheckProgressUseCase).
 */
import { fillTemplate } from './fill';

const TEMPLATE = `You are in the repository workspace. Assess the progress of issue #{{issueNumber}} using the full diff between the base (parent) branch and the current branch.

{{projectContextInstruction}}

**Branches:**
- **Base (parent) branch:** \`{{baseBranch}}\`
- **Current branch:** \`{{currentBranch}}\`

**Instructions:**
1. Get the full diff by running: \`git diff {{baseBranch}}..{{currentBranch}}\` (or \`git diff {{baseBranch}}...{{currentBranch}}\` for merge-base). If you cannot run shell commands, use whatever workspace tools you have to inspect changes between these branches.
2. Optionally confirm the current branch with \`git branch --show-current\` if needed.
3. Based on the full diff and the issue description below, assess completion progress (0-100%) and write a short summary.
4. If progress is below 100%, add a "remaining" field with a short description of what is left to do to complete the task (e.g. missing implementation, tests, docs). Omit "remaining" or leave empty when progress is 100%.

**Issue description:**
{{issueDescription}}

Respond with a single JSON object: { "progress": <number 0-100>, "summary": "<short explanation>", "remaining": "<what is left to reach 100%, only when progress < 100>" }.`;

export type CheckProgressParams = {
    projectContextInstruction: string;
    issueNumber: string;
    baseBranch: string;
    currentBranch: string;
    issueDescription: string;
};

export function getCheckProgressPrompt(params: CheckProgressParams): string {
    return fillTemplate(TEMPLATE, {
        projectContextInstruction: params.projectContextInstruction,
        issueNumber: String(params.issueNumber),
        baseBranch: params.baseBranch,
        currentBranch: params.currentBranch,
        issueDescription: params.issueDescription,
    });
}
