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

            // Process changes in blocks of 3 files
            const BLOCK_SIZE = 3;
            const blocks = [];
            for (let i = 0; i < changes.length; i += BLOCK_SIZE) {
                blocks.push(changes.slice(i, i + BLOCK_SIZE));
            }

            let finalDescription = '';
            
            // Process each block
            for (let i = 0; i < blocks.length; i++) {
                const block = blocks[i];
                let blockPrompt = `Please analyze the following changes (block ${i + 1} of ${blocks.length}):\n\n`;
                
                // Add file changes to prompt
                block.forEach(change => {
                    blockPrompt += `File: ${change.filename}\n`;
                    blockPrompt += `Status: ${change.status}\n`;
                    blockPrompt += `Changes: +${change.additions} -${change.deletions}\n`;
                    if (change.patch) {
                        blockPrompt += `Patch:\n${change.patch}\n`;
                    }
                    blockPrompt += `\n`;
                });

                blockPrompt += `\nPlease provide a detailed analysis of these changes including:\n`;
                blockPrompt += `1. Summary of changes in these files\n`;
                blockPrompt += `2. Technical details of the modifications\n`;
                //blockPrompt += `3. Potential impact on the system\n`;
                //blockPrompt += `4. Testing considerations\n`;

                // Get AI response for this block
                const blockDescription = await this.aiRepository.askChatGPT(
                    blockPrompt,
                    param.ai.getOpenaiApiKey()
                );

                finalDescription += blockDescription + '\n\n';
            }

            // Generate final summary prompt
            const summaryPrompt = `Based on the following detailed analysis of changes, please provide a concise and well-structured pull request description that includes:\n\n${finalDescription}\n\nPlease format the final description in a clear and organized way, highlighting the key changes and their impact.`;

            // Get final summary
            const description = await this.aiRepository.askChatGPT(
                summaryPrompt,
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