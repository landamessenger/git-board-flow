import { Execution } from "../../../data/model/execution";
import { Result } from "../../../data/model/result";
import { AiRepository, OPENCODE_AGENT_PLAN } from "../../../data/repository/ai_repository";
import { IssueRepository } from "../../../data/repository/issue_repository";
import { ProjectRepository } from "../../../data/repository/project_repository";
import { PullRequestRepository } from "../../../data/repository/pull_request_repository";
import { getUpdatePullRequestDescriptionPrompt } from "../../../prompts";
import { logDebugInfo, logError } from "../../../utils/logger";
import { OPENCODE_PROJECT_CONTEXT_INSTRUCTION } from "../../../utils/opencode_project_context_instruction";
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

            const prompt = getUpdatePullRequestDescriptionPrompt({
                projectContextInstruction: OPENCODE_PROJECT_CONTEXT_INSTRUCTION,
                baseBranch,
                headBranch,
                issueNumber: String(param.issueNumber),
                issueDescription,
            });

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
}
