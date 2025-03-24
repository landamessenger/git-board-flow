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

            const changesDescription = await this.processChanges(changes, param.ai.getAiIgnoreFiles(), param.ai.getOpenaiApiKey(), param.ai.getOpenaiModel());

            const descriptionPrompt = `this an issue descrition.
define a description for the pull request which closes the issue and avoid the use of titles (#, ##, ###).
just a text description:\n\n
${issueDescription}`;

            const currentDescription = await this.aiRepository.askChatGPT(
                descriptionPrompt,
                param.ai.getOpenaiApiKey(),
                param.ai.getOpenaiModel(),
            );

            // Update pull request description
            await this.pullRequestRepository.updateDescription(
                param.owner,
                param.repo,
                prNumber,
                `
#${param.issueNumber}

## What does this PR do?

${currentDescription}

## What files were changed?

${changesDescription}
`,
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

    private splitPatchIntoSections(patch: string): string[] {
        if (!patch) return [];
        return patch.split(/(?=@@)/).filter(section => section.trim().length > 0);
    }

    private async processPatchSection(
        section: string,
        filename: string,
        status: string,
        additions: number,
        deletions: number,
        openaiApiKey: string,
        openaiModel: string
    ): Promise<string> {
        const filePrompt = `Do a summary of the changes in this file section (no titles, just a text description, avoid to use the file name or expressions like "this file" or "this section". Try to start the explanation with what was changed directly and highlight any piece of code mentioned):\n\n` +
            `File: ${filename}\n` +
            `Status: ${status}\n` +
            `Changes: +${additions} -${deletions}\n` +
            `Patch section:\n${section}`;

        return await this.aiRepository.askChatGPT(filePrompt, openaiApiKey, openaiModel);
    }

    private async processChanges(
        changes: { filename: string; status: string; additions: number; deletions: number; patch?: string }[],
        ignoreFiles: string[],
        openaiApiKey: string,
        openaiModel: string
    ): Promise<string> {
        let changesDescription = ``;
        
        for (const change of changes) {
            try {
                const shouldIgnoreFile = this.shouldIgnoreFile(change.filename, ignoreFiles);
                if (shouldIgnoreFile) {
                    continue;
                }

                const fileDescription = await this.processFile(change, openaiApiKey, openaiModel);
                changesDescription += `- \`${change.filename}\`:\n  ${fileDescription}\n\n`;
            } catch (error) {
                console.error(error);
                throw new Error(`Error processing file ${change.filename}: ${error}`);
            }
        }

        return changesDescription;
    }

    private async processFile(
        change: { filename: string; status: string; additions: number; deletions: number; patch?: string },
        openaiApiKey: string,
        openaiModel: string
    ): Promise<string> {
        if (!change.patch) {
            return `File was ${change.status} (${change.additions} additions, ${change.deletions} deletions)`;
        }

        const patchSections = this.splitPatchIntoSections(change.patch);
        const sectionDescriptions = await Promise.all(
            patchSections.map(section => 
                this.processPatchSection(
                    section,
                    change.filename,
                    change.status,
                    change.additions,
                    change.deletions,
                    openaiApiKey,
                    openaiModel
                )
            )
        );
        return sectionDescriptions.map(desc => `- ${desc}`).join('\n  ');
    }
}