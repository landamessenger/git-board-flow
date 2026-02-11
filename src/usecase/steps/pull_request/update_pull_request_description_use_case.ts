import { Execution } from "../../../data/model/execution";
import { Result } from "../../../data/model/result";
import { AiRepository, OPENCODE_AGENT_PLAN } from "../../../data/repository/ai_repository";
import { IssueRepository } from "../../../data/repository/issue_repository";
import { ProjectRepository } from "../../../data/repository/project_repository";
import { PullRequestRepository } from "../../../data/repository/pull_request_repository";
import { logDebugInfo, logError } from "../../../utils/logger";
import { getTaskEmoji } from "../../../utils/task_emoji";
import { ParamUseCase } from "../../base/param_usecase";

export class UpdatePullRequestDescriptionUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'UpdatePullRequestDescriptionUseCase';

    private aiRepository = new AiRepository();
    private pullRequestRepository = new PullRequestRepository();
    private issueRepository = new IssueRepository();
    private projectRepository = new ProjectRepository();

    async invoke(param: Execution): Promise<Result[]> {
        logDebugInfo(`${getTaskEmoji(this.taskId)} Executing ${this.taskId}.`);

        const result: Result[] = [];

        try {
            const prNumber = param.pullRequest.number;
            const headBranch = param.pullRequest.head;
            const baseBranch = param.pullRequest.base;

            if (!headBranch || !baseBranch) {
                result.push(
                    new Result({
                        id: this.taskId,
                        success: false,
                        executed: false,
                        steps: [
                            `Could not determine PR branches (head: ${headBranch ?? 'missing'}, base: ${baseBranch ?? 'missing'}). Skipping update pull request description.`,
                        ],
                    })
                );
                return result;
            }

            logDebugInfo(
                `PR description will be generated from workspace diff: base "${baseBranch}", head "${headBranch}" (OpenCode agent will run git diff).`
            );

            const issueDescription = await this.issueRepository.getIssueDescription(
                param.owner,
                param.repo,
                param.issueNumber,
                param.tokens.token
            );

            if (issueDescription.length === 0) {
                result.push(
                    new Result({
                        id: this.taskId,
                        success: false,
                        executed: false,
                        steps: [
                            `No issue description found. Skipping update pull request description.`,
                        ],
                    })
                );
                return result;
            }

            const currentProjectMembers = await this.projectRepository.getAllMembers(
                param.owner,
                param.tokens.token
            );
            const pullRequestCreatorIsTeamMember =
                param.pullRequest.creator.length > 0 &&
                currentProjectMembers.indexOf(param.pullRequest.creator) > -1;

            if (!pullRequestCreatorIsTeamMember && param.ai.getAiMembersOnly()) {
                result.push(
                    new Result({
                        id: this.taskId,
                        success: false,
                        executed: false,
                        steps: [
                            `The pull request creator @${param.pullRequest.creator} is not a team member and \`AI members only\` is enabled. Skipping update pull request description.`,
                        ],
                    })
                );
                return result;
            }

            const prompt = this.buildPrDescriptionPrompt(
                param.issueNumber,
                issueDescription,
                headBranch,
                baseBranch
            );

            const agentResponse = await this.aiRepository.askAgent(
                param.ai,
                OPENCODE_AGENT_PLAN,
                prompt
            );

            const prBody =
                typeof agentResponse === 'string'
                    ? agentResponse
                    : (agentResponse && String((agentResponse as Record<string, unknown>).description)) || '';

            if (!prBody.trim()) {
                result.push(
                    new Result({
                        id: this.taskId,
                        success: false,
                        executed: true,
                        steps: [`OpenCode Plan agent did not return a PR description.`],
                    })
                );
                return result;
            }

            await this.pullRequestRepository.updateDescription(
                param.owner,
                param.repo,
                prNumber,
                prBody,
                param.tokens.token
            );

            result.push(
                new Result({
                    id: this.taskId,
                    success: true,
                    executed: true,
                    steps: [],
                })
            );
        } catch (error) {
            logError(error);
            result.push(
                new Result({
                    id: this.taskId,
                    success: false,
                    executed: true,
                    steps: [`Error updating pull request description: ${error}`],
                })
            );
        }

        return result;
    }

    /**
     * Builds the PR description prompt. We do not send the diff from our side:
     * we pass the base and head branch so the OpenCode agent can run `git diff`
     * in the workspace. The agent must read the repo's PR template and fill it
     * with the same structure (sections, headings, checkboxes).
     */
    private buildPrDescriptionPrompt(
        issueNumber: number,
        issueDescription: string,
        headBranch: string,
        baseBranch: string
    ): string {
        return `You are in the repository workspace. Your task is to produce a pull request description by filling the project's PR template with information from the branch diff and the issue.

**Branches:**
- **Base (target) branch:** \`${baseBranch}\`
- **Head (source) branch:** \`${headBranch}\`

**Instructions:**
1. Read the pull request template file: \`.github/pull_request_template.md\`. Use its structure (headings, bullet lists, separators) as the skeleton for your output. The checkboxes in the template are **indicative only**: you may check the ones that apply based on the project and the diff, define different or fewer checkboxes if that fits better, or omit a section entirely if it does not apply.
2. Get the full diff by running: \`git diff ${baseBranch}..${headBranch}\` (or \`git diff ${baseBranch}...${headBranch}\` for merge-base). Use the diff to understand what changed.
3. Use the issue description below for context and intent.
4. Fill each section of the template with concrete content derived from the diff and the issue. Keep the same markdown structure (headings, horizontal rules). For checkbox sections (e.g. Test Coverage, Deployment Notes, Security): use the template's options as guidance; check or add only the items that apply, or skip the section if not relevant.
   - **Summary:** brief explanation of what the PR does and why (intent, not implementation details).
   - **Related Issues:** include \`Closes #${issueNumber}\` and "Related to #" only if relevant.
   - **Scope of Changes:** use Added / Updated / Removed / Refactored with short bullet points (high level, not file-by-file).
   - **Technical Details:** important decisions, trade-offs, or non-obvious aspects.
   - **How to Test:** steps a reviewer can follow (infer from the changes when possible).
   - **Test Coverage / Deployment / Security / Performance / Checklist:** treat checkboxes as indicative; check the ones that apply from the diff and project context, or omit the section if it does not apply.
   - **Breaking Changes:** list any, or "None".
   - **Notes for Reviewers / Additional Context:** fill only if useful; otherwise a short placeholder or omit.
5. Do not output a single compact paragraph. Output the full filled template so the PR description is well-structured and easy to scan. Preserve the template's formatting (headings with # and ##, horizontal rules). Use checkboxes \`- [ ]\` / \`- [x]\` only where they add value; you may simplify or drop a section if it does not apply.

**Issue description:**
${issueDescription}

Output only the filled template content (the PR description body), starting with the first heading of the template (e.g. # Summary). Do not wrap it in code blocks or add extra commentary.`;
    }
}
