/**
 * Builds the prompt for OpenCode (plan agent) when detecting potential problems on push.
 * We pass: repo context, head/base branch names (OpenCode computes the diff itself), issue number,
 * optional ignore patterns, and the block of previously reported findings (task 2).
 * We do not pass a pre-computed diff or file list.
 */

import { OPENCODE_PROJECT_CONTEXT_INSTRUCTION } from "../../../../utils/opencode_project_context_instruction";
import type { Execution } from "../../../../data/model/execution";
import type { BugbotContext } from "./types";

export function buildBugbotPrompt(param: Execution, context: BugbotContext): string {
    const headBranch = param.commit.branch;
    const baseBranch = param.currentConfiguration.parentBranch ?? param.branches.development ?? 'develop';
    const previousBlock = context.previousFindingsBlock;
    const ignorePatterns = param.ai?.getAiIgnoreFiles?.() ?? [];
    const ignoreBlock =
        ignorePatterns.length > 0
            ? `\n**Files to ignore:** Do not report findings in files or paths matching these patterns: ${ignorePatterns.join(', ')}.`
            : '';

    return `You are analyzing the latest code changes for potential bugs and issues.

${OPENCODE_PROJECT_CONTEXT_INSTRUCTION}

**Repository context:**
- Owner: ${param.owner}
- Repository: ${param.repo}
- Branch (head): ${headBranch}
- Base branch: ${baseBranch}
- Issue number: ${param.issueNumber}
${ignoreBlock}

**Your task 1 (new/current problems):** Determine what has changed in the branch "${headBranch}" compared to "${baseBranch}" (you must compute or obtain the diff yourself using the repository context above). Then identify potential bugs, logic errors, security issues, and code quality problems. Be strict and descriptive. One finding per distinct problem. Return them in the \`findings\` array (each with id, title, description; optionally file, line, severity, suggestion). Only include findings in files that are not in the ignore list above.
${previousBlock}

**Output:** Return a JSON object with: "findings" (array of new/current problems from task 1), and if we gave you previously reported issues above, "resolved_finding_ids" (array of those ids that are now fixed or no longer apply, as per task 2).`;
}
