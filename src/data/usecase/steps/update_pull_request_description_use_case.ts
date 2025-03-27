import { Execution } from "../../model/execution";
import { Result } from "../../model/result";
import { AiRepository } from "../../repository/ai_repository";
import { IssueRepository } from "../../repository/issue_repository";
import { ProjectRepository } from "../../repository/project_repository";
import { PullRequestRepository } from "../../repository/pull_request_repository";
import { logDebugInfo, logError } from "../../utils/logger";
import { ParamUseCase } from "../base/param_usecase";
import { PatchSummary } from "../../../graph/ai_responses";

export class UpdatePullRequestDescriptionUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'UpdatePullRequestDescriptionUseCase';
    private aiRepository = new AiRepository();
    private pullRequestRepository = new PullRequestRepository();
    private issueRepository = new IssueRepository();
    private projectRepository = new ProjectRepository();

    async invoke(param: Execution): Promise<Result[]> {
        logDebugInfo(`Executing ${this.taskId}.`)

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
            logError(error);
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
                .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape special regex characters (sin afectar *)
                .replace(/\*/g, '.*') // Convert * to match anything
                .replace(/\//g, '\\/'); // Escape forward slashes
    
            // Allow pattern ending on /* to ignore also subdirectories and files inside
            if (pattern.endsWith("/*")) {
                return new RegExp(`^${regexPattern.replace(/\\\/\.\*$/, "(\\/.*)?")}$`).test(filename);
            }
    
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
    ): Promise<PatchSummary | undefined> {
        const filePrompt = `Summarize the following code patch in JSON format.

### **Guidelines**:
- Output must be a **valid JSON** object.
- Each file should be listed **only once**.
- Provide a high-level summary and a list of key changes.
- Use **camelCase** for keys.

### **Output Format Example**:
\`\`\`json
{
    "filePath": "src/utils/logger.ts",
    "summary": "Refactored logging system for better error handling.",
    "changes": [
        "Replaced \`console.error\` with \`logError\`.",
        "Added support for async logging.",
        "Removed unused function \`debugLog\`."
    ]
}
\`\`\`

### **Metadata**:
- **Filename:** ${filename}
- **Status:** ${status}
- **Changes:** +${additions} / -${deletions}

### **Patch**:
${section}`;
        
        const response = await this.aiRepository.askChatGPT(filePrompt, openaiApiKey, openaiModel);

        try {
            const patchSummary: PatchSummary = JSON.parse(response);
            return patchSummary;
        } catch (error) {
            logError(`Error parsing JSON response: ${error}`);
            return undefined;
        }
    }

    private isLargeChange(change: { additions: number; deletions: number; patch?: string }): boolean {
        // Consider changes large if:
        // 1. Total changes (additions + deletions) are more than 500 lines
        // 2. Or if there are more than 250 additions or deletions
        const totalChanges = change.additions + change.deletions;
        return totalChanges > 500 || change.additions > 250 || change.deletions > 250;
    }

    private async processChanges(
        changes: { filename: string; status: string; additions: number; deletions: number; patch?: string }[],
        ignoreFiles: string[],
        openaiApiKey: string,
        openaiModel: string
    ): Promise<string> {
        logDebugInfo(`Processing ${changes.length} changes`);
        const fileDescriptions: PatchSummary[] = [];
        for (const change of changes) {
            try {
                logDebugInfo(`Processing changes for file ${change.filename}`);
                const shouldIgnoreFile = this.shouldIgnoreFile(change.filename, ignoreFiles);
                if (shouldIgnoreFile) {
                    logDebugInfo(`File ${change.filename} should be ignored`);
                    continue;
                }

                if (this.isLargeChange(change)) {
                    logDebugInfo(`File ${change.filename} has large changes, processing by sections`);
                    fileDescriptions.push(...await this.processFileBySections(change, openaiApiKey, openaiModel));
                } else {
                    logDebugInfo(`File ${change.filename} has moderate changes, processing as whole`);
                    fileDescriptions.push(...await this.processFile(change, openaiApiKey, openaiModel));
                }
            } catch (error) {
                logError(error);
                throw new Error(`Error processing file ${change.filename}: ${error}`);
            }
        }

        // Group files by directory
        const groupedFiles = this.groupFilesByDirectory(fileDescriptions);
        
        // Generate a structured description
        let description = '';
        
        // Add summary section if there are files
        if (fileDescriptions.length > 0) {
            description += '## Summary of Changes\n\n';
            description += fileDescriptions.map(file => 
                `- **${file.filePath}**: ${file.summary}`
            ).join('\n');
            description += '\n\n';
        }

        // Add detailed changes section
        description += '## Detailed Changes\n\n';
        
        // Process each directory group
        for (const [directory, files] of Object.entries(groupedFiles)) {
            if (directory === 'root') {
                // Files in root directory
                description += files.map(file => this.formatFileChanges(file)).join('\n\n') + `\n\n`;
            } else {
                // Files in subdirectories
                description += `### ${directory}\n\n`;
                description += files.map(file => this.formatFileChanges(file)).join('\n\n') + `\n\n`;
            }
        }

        return description;
    }

    private groupFilesByDirectory(files: PatchSummary[]): { [key: string]: PatchSummary[] } {
        const groups: { [key: string]: PatchSummary[] } = {
            root: []
        };

        files.forEach(file => {
            const pathParts = file.filePath.split('/');
            if (pathParts.length > 1) {
                const directory = pathParts.slice(0, -1).join('/');
                if (!groups[directory]) {
                    groups[directory] = [];
                }
                groups[directory].push(file);
            } else {
                groups.root.push(file);
            }
        });

        return groups;
    }

    private formatFileChanges(file: PatchSummary): string {
        let output = `#### \`${file.filePath}\`\n\n`;
        output += `${file.summary}\n\n`;
        
        if (file.changes.length > 0) {
            output += '**Changes:**\n';
            output += file.changes.map(change => `- ${change}`).join('\n');
        }

        return output;
    }

    private async processFileBySections(
        change: { filename: string; status: string; additions: number; deletions: number; patch?: string },
        openaiApiKey: string,
        openaiModel: string
    ): Promise<PatchSummary[]> {
        if (!change.patch) {
            return [];
        }

        const patchSections = this.splitPatchIntoSections(change.patch);
        logDebugInfo(`Processing ${patchSections.length} sections for file ${change.filename}`);

        const sectionDescriptions = await Promise.all(
            patchSections.map((section, index) => 
                this.processPatchSection(
                    section,
                    `${change.filename} (section ${index + 1}/${patchSections.length})`,
                    change.status,
                    change.additions,
                    change.deletions,
                    openaiApiKey,
                    openaiModel
                )
            )
        );

        return sectionDescriptions.filter((desc: PatchSummary | undefined) => desc !== undefined);
    }

    private async processFile(
        change: { filename: string; status: string; additions: number; deletions: number; patch?: string },
        openaiApiKey: string,
        openaiModel: string
    ): Promise<PatchSummary[]> {
        if (!change.patch) {
            return [];
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
        return sectionDescriptions.filter((desc: PatchSummary | undefined) => desc !== undefined);
    }
}