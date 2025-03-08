import * as core from "@actions/core";
import { Execution } from "../../model/execution";
import { Result } from "../../model/result";
import { ParamUseCase } from "../base/param_usecase";
import { AiRepository } from "../../repository/ai_repository";
import { PullRequestRepository } from "../../repository/pull_request_repository";
import { ProjectRepository } from "../../repository/project_repository";

export class UpdatePullRequestDescriptionUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'UpdatePullRequestDescriptionUseCase';
    private aiRepository = new AiRepository();
    private pullRequestRepository = new PullRequestRepository();
    private projectRepository = new ProjectRepository();
    async invoke(param: Execution): Promise<Result[]> {
        core.info(`Executing ${this.taskId}.`)

        const result: Result[] = []

        try {
            const prNumber = param.pullRequest.number;


            const currentProjectMembers = await this.projectRepository.getAllMembers(param.owner, param.tokens.tokenPat);
            const pullRequestCreatorIsTeamMember = param.pullRequest.creator.length > 0
                && currentProjectMembers.indexOf(param.pullRequest.creator) > -1;


            if (!pullRequestCreatorIsTeamMember && param.ai.getAiMembersOnly()) {
                result.push(
                    new Result(
                        {
                            id: this.taskId,
                            success: false,
                            executed: false,
                            steps: [
                                `The pull request creator @${param.pullRequest.creator} is not a team member and \`AI members only\` is enabled. Skipping update pull request description.`
                            ]
                        }
                    )
                );
                return result;
            }

            const changes = await this.pullRequestRepository.getPullRequestChanges(
                param.owner,
                param.repo,
                prNumber,
                param.tokens.token
            );

            // Generate prompt for AI
            let prompt = `Please generate a detailed pull request description for the following changes:\n\n`;
            
            // Add file changes to prompt
            changes.forEach(change => {
                prompt += `File: ${change.filename}\n`;
                prompt += `Status: ${change.status}\n`;
                prompt += `Changes: +${change.additions} -${change.deletions}\n`;
                if (change.patch) {
                    prompt += `Patch:\n${change.patch}\n`;
                }
                prompt += `\n`;
            });

            prompt += `\nPlease include:\n`;
            prompt += `1. A brief summary of the changes\n`;
            prompt += `2. Technical details of what was changed\n`;
            prompt += `3. Any potential impact on other parts of the system\n`;
            prompt += `4. Testing considerations\n`;

            // Get AI response
            const description = await this.aiRepository.askChatGPT(
                prompt,
                param.ai.getOpenaiApiKey()
            );

            const currentDescription = param.pullRequest.body;

            // Update pull request description
            await this.pullRequestRepository.updateDescription(
                param.owner,
                param.repo,
                prNumber,
                currentDescription + '\n\n' + description,
                param.tokens.token
            );

            result.push(
                new Result(
                    {
                        id: this.taskId,
                        success: true,
                        executed: true,
                        steps: [
                            `The description has been updated with AI-generated content.`
                        ]
                    }
                )
            );
            
        } catch (error) {
            console.error(error);
            result.push(
                new Result(
                    {
                        id: this.taskId,
                        success: false,
                        executed: true,
                        steps: [
                            `Error updating pull request description: ${error}`
                        ]
                    }
                )
            );
        }

        return result;
    }
}