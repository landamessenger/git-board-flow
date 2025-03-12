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

            let finalDescription = '';
            
            // Process each file individually
            for (const change of changes) {
                let filePrompt = `Please analyze the following changes:\n\n`;
                filePrompt += `File: ${change.filename}\n`;
                filePrompt += `Status: ${change.status}\n`;
                filePrompt += `Changes: +${change.additions} -${change.deletions}\n`;
                if (change.patch) {
                    filePrompt += `Patch:\n${change.patch}\n`;
                }
                filePrompt += `\nPlease provide a detailed analysis of the changes in this file. Use this as example:\n\n`;
                filePrompt += `- \`file/path\`: summary details of the changes in this file\n`;
                // Get AI response for this file
                const fileDescription = await this.aiRepository.askChatGPT(
                    filePrompt,
                    param.ai.getOpenaiApiKey()
                );

                finalDescription += fileDescription + '\n\n';
            }

            const currentDescription = param.pullRequest.body;

            // Update pull request description
            await this.pullRequestRepository.updateDescription(
                param.owner,
                param.repo,
                prNumber,
                currentDescription + '\n\n' + finalDescription,
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