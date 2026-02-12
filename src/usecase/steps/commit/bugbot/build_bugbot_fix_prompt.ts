import type { Execution } from "../../../../data/model/execution";
import type { BugbotContext } from "./types";
import { OPENCODE_PROJECT_CONTEXT_INSTRUCTION } from "../../../../utils/opencode_project_context_instruction";
import { sanitizeUserCommentForPrompt } from "./sanitize_user_comment_for_prompt";

/** Maximum characters for a single finding's full comment body to avoid prompt bloat and token limits. */
const MAX_FINDING_BODY_LENGTH = 12000;

const TRUNCATION_SUFFIX = "\n\n[... truncated for length ...]";

/**
 * Truncates body to max length and appends indicator when truncated.
 */
function truncateFindingBody(body: string, maxLength: number): string {
    if (body.length <= maxLength) return body;
    return body.slice(0, maxLength - TRUNCATION_SUFFIX.length) + TRUNCATION_SUFFIX;
}

/**
 * Builds the prompt for the OpenCode build agent to fix the selected bugbot findings.
 * Includes repo context, the findings to fix (with full detail), the user's comment,
 * strict scope rules, and the verify commands to run.
 */
export function buildBugbotFixPrompt(
    param: Execution,
    context: BugbotContext,
    targetFindingIds: string[],
    userComment: string,
    verifyCommands: string[]
): string {
    const headBranch = param.commit.branch;
    const baseBranch = param.currentConfiguration.parentBranch ?? param.branches.development ?? "develop";
    const issueNumber = param.issueNumber;
    const owner = param.owner;
    const repo = param.repo;
    const openPrNumbers = context.openPrNumbers;
    const prNumber = openPrNumbers.length > 0 ? openPrNumbers[0] : null;

    const findingsBlock = targetFindingIds
        .map((id) => {
            const data = context.existingByFindingId[id];
            if (!data) return null;
            const issueBody = context.issueComments.find((c) => c.id === data.issueCommentId)?.body ?? null;
            const fullBody = truncateFindingBody((issueBody?.trim() ?? ""), MAX_FINDING_BODY_LENGTH);
            if (!fullBody) return null;
            return `---\n**Finding id:** \`${id}\`\n\n**Full comment (title, description, location, suggestion):**\n${fullBody}\n`;
        })
        .filter(Boolean)
        .join("\n");

    const verifyBlock =
        verifyCommands.length > 0
            ? `\n**Verify commands (run these in the workspace in order and only consider the fix successful if all pass):**\n${verifyCommands.map((c) => `- \`${c}\``).join("\n")}\n`
            : "\n**Verify:** Run any standard project checks (e.g. build, test, lint) that exist in this repo and confirm they pass.\n";

    return `You are in the repository workspace. Your task is to fix the reported code findings (bugs, vulnerabilities, or quality issues) listed below, and only those. The user has explicitly requested these fixes.

${OPENCODE_PROJECT_CONTEXT_INSTRUCTION}

**Repository context:**
- Owner: ${owner}
- Repository: ${repo}
- Branch (head): ${headBranch}
- Base branch: ${baseBranch}
- Issue number: ${issueNumber}
${prNumber != null ? `- Pull request number: ${prNumber}` : ""}

**Findings to fix (do not change code unrelated to these):**
${findingsBlock}

**User request:**
"""
${sanitizeUserCommentForPrompt(userComment)}
"""

**Rules:**
1. Fix only the problems described in the findings above. Do not refactor or change other code except as strictly necessary for the fix.
2. You may add or update tests only to validate that the fix is correct.
3. After applying changes, run the verify commands (or standard build/test/lint) and ensure they all pass. If they fail, adjust the fix until they pass.
4. Apply all changes directly in the workspace (edit files, run commands). Do not output diffs for someone else to apply.
${verifyBlock}

Once the fixes are applied and the verify commands pass, reply briefly confirming what was fixed and that checks passed.`;
}
