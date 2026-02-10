import type { Execution } from "../../../../data/model/execution";
import type { BugbotContext } from "./types";

export function buildBugbotPrompt(param: Execution, context: BugbotContext): string {
    const headBranch = param.commit.branch;
    const baseBranch = param.currentConfiguration.parentBranch ?? param.branches.development ?? 'develop';
    const issueNumber = param.issueNumber;
    const previousBlock = context.previousFindingsBlock;

    return `You are analyzing the latest code changes for potential bugs and issues.

**Repository context:**
- Owner: ${param.owner}
- Repository: ${param.repo}
- Branch (head): ${headBranch}
- Base branch: ${baseBranch}
- Issue number: ${issueNumber}

**Your task 1:** Determine what has changed in the branch "${headBranch}" compared to "${baseBranch}" (you must compute or obtain the diff yourself using the repository context above). Then identify potential bugs, logic errors, security issues, and code quality problems. Be strict and descriptive. One finding per distinct problem. Return them in the \`findings\` array (each with id, title, description; optionally file, line, severity, suggestion).
${previousBlock}

Return a JSON object with: "findings" (array of new/current problems), and if we gave you a list of previously reported issues above, "resolved_finding_ids" (array of those ids that are now fixed in the current code).`;
}
