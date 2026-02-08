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

            const changes = await this.pullRequestRepository.getPullRequestChanges(
                param.owner,
                param.repo,
                prNumber,
                param.tokens.token
            );

            const filteredChanges = changes.filter(
                (c) => !this.shouldIgnoreFile(c.filename, param.ai.getAiIgnoreFiles())
            );

            const prompt = this.buildPrDescriptionPrompt(issueDescription, filteredChanges);

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

    private buildPrDescriptionPrompt(
        issueDescription: string,
        changes: { filename: string; status: string; additions: number; deletions: number; patch?: string }[]
    ): string {
        const changesBlock = changes
            .map((c) => {
                const header = `### ${c.filename} (${c.status}, +${c.additions}/-${c.deletions})`;
                const patch = c.patch ? `\n\`\`\`diff\n${c.patch}\n\`\`\`` : '';
                return header + patch;
            })
            .join('\n\n');

        return `You are helping write a pull request description. The PR closes an issue.

**Issue description:**
${issueDescription}

**Changed files and patches:**
${changesBlock}

**Instructions:**
- Write one short paragraph describing what this PR does (plain text, no markdown titles like # or ##).
- Then add a "Summary of Changes" section and a "Detailed Changes" section if there are multiple files.
- Do not use titles (#, ##, ###) in the first paragraph; only in the summary/detailed sections.
- Output only the description content (the "What does this PR do?" paragraph plus optional sections).`;
    }

    private shouldIgnoreFile(filename: string, ignorePatterns: string[]): boolean {
        if (ignorePatterns.length === 0) return false;
        return ignorePatterns.some((pattern) => {
            const regexPattern = pattern
                .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
                .replace(/\*/g, '.*')
                .replace(/\//g, '\\/');
            if (pattern.endsWith('/*')) {
                return new RegExp(`^${regexPattern.replace(/\\\/\.\*$/, '(\\/.*)?')}$`).test(
                    filename
                );
            }
            return new RegExp(`^${regexPattern}$`).test(filename);
        });
    }
}
