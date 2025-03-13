import * as core from "@actions/core";
import { Execution } from "../../model/execution";
import { Result } from "../../model/result";
import { ParamUseCase } from "../base/param_usecase";
import { AiRepository } from "../../repository/ai_repository";
import { PullRequestRepository } from "../../repository/pull_request_repository";
import { ProjectRepository } from "../../repository/project_repository";
import { IssueRepository } from "../../repository/issue_repository";
export class UpdatePullRequestDescriptionUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'UpdatePullRequestDescriptionUseCase';
    private aiRepository = new AiRepository();
    private pullRequestRepository = new PullRequestRepository();
    private issueRepository = new IssueRepository();
    private projectRepository = new ProjectRepository();
    async invoke(param: Execution): Promise<Result[]> {
        core.info(`Executing ${this.taskId}.`)

        const result: Result[] = []

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
                    new Result(
                        {
                            id: this.taskId,
                            success: false,
                            executed: false,
                            steps: [
                                `No issue description found. Skipping update pull request description.`
                            ]
                        }
                    )
                );
                return result;
            }

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

            let changesDescription = `### Summary of changes\n\n`;
            
            // Process each file individually
            for (const change of changes) {
                const shouldIgnoreFile = this.shouldIgnoreFile(change.filename, param.ai.getAiIgnoreFiles());
                if (shouldIgnoreFile) {
                    continue;
                }

                let filePrompt = `Do a summary of the changes in this file (no titles, just a text description):\n\n`;
                filePrompt += `File: ${change.filename}\n`;
                filePrompt += `Status: ${change.status}\n`;
                filePrompt += `Changes: +${change.additions} -${change.deletions}\n`;
                if (change.patch) {
                    filePrompt += `Patch:\n${change.patch}\n`;
                }
                // Get AI response for this file
                const fileDescription = await this.aiRepository.askChatGPT(
                    filePrompt,
                    param.ai.getOpenaiApiKey()
                );

                changesDescription += `\`${change.filename}\`: ${fileDescription}\n`;
            }

            const descriptionPrompt = `this an issue descrition.
define a description for the pull request which closes the issue and avoid the use of titles (#, ##, ###).
just a text description:\n\n
${issueDescription}`;

            const currentDescription = await this.aiRepository.askChatGPT(
                descriptionPrompt,
                param.ai.getOpenaiApiKey()
            );

            // Update pull request description
            await this.pullRequestRepository.updateDescription(
                param.owner,
                param.repo,
                prNumber,
                currentDescription + '\n\n' + changesDescription,
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

    private shouldIgnoreFile(filename: string, ignorePatterns: string[]): boolean {
        return ignorePatterns.some(pattern => {
            // Convert glob pattern to regex
            const regexPattern = pattern
                .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escape special regex characters
                .replace(/\*/g, '.*') // Convert * to regex wildcard
                .replace(/\//g, '\\/'); // Escape forward slashes
            
            const regex = new RegExp(`^${regexPattern}$`);
            return regex.test(filename);
        });
    }
}