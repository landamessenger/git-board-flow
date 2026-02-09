import { Execution } from "../../../data/model/execution";
import { Result } from "../../../data/model/result";
import { AiRepository, OPENCODE_AGENT_PLAN } from "../../../data/repository/ai_repository";
import { IssueRepository } from "../../../data/repository/issue_repository";
import { ProjectRepository } from "../../../data/repository/project_repository";
import { PullRequestRepository } from "../../../data/repository/pull_request_repository";
import { logDebugInfo, logError } from "../../../utils/logger";
import { ParamUseCase } from "../../base/param_usecase";

export class UpdatePullRequestDescriptionUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'UpdatePullRequestDescriptionUseCase';

    private aiRepository = new AiRepository();
    private pullRequestRepository = new PullRequestRepository();
    private issueRepository = new IssueRepository();
    private projectRepository = new ProjectRepository();

    async invoke(param: Execution): Promise<Result[]> {
        logDebugInfo(`Executing ${this.taskId}.`);

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

            const prompt = this.buildPrDescriptionPrompt(issueDescription, headBranch, baseBranch);

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
                `#${param.issueNumber}\n\n## What does this PR do?\n\n${prBody.trim()}`,
                param.tokens.token
            );

            result.push(
                new Result({
                    id: this.taskId,
                    success: true,
                    executed: true,
                    steps: [`The description has been updated with AI-generated content (OpenCode Plan agent).`],
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
     * in the workspace and write a professional summary (not a file-by-file list).
     */
    private buildPrDescriptionPrompt(
        issueDescription: string,
        headBranch: string,
        baseBranch: string
    ): string {
        return `You are in the repository workspace. Write a pull request description based on the diff between the base (target) branch and the head (source) branch.

**Branches:**
- **Base (target) branch:** \`${baseBranch}\`
- **Head (source) branch:** \`${headBranch}\`

**Instructions:**
1. Get the full diff by running: \`git diff ${baseBranch}..${headBranch}\` (or \`git diff ${baseBranch}...${headBranch}\` for merge-base). If you cannot run shell commands, use whatever workspace tools you have to inspect changes between these branches.
2. Read the issue description below for context.
3. Based on the diff and the issue, write a **professional summary** of what this PR does at a high level. Focus on:
   - The main goal and outcome of the change.
   - Key or important points (e.g. breaking changes, new capabilities, critical fixes).
   - Do not list every file or give a change-by-change breakdown; keep it concise and useful for reviewers.

**Issue description:**
${issueDescription}

Output only the description content: one short paragraph (plain text, no markdown titles in the first paragraph), optionally followed by a "Key points" or "Summary" section if it helps. Do not use # or ## in the first paragraph.`;
    }
}
