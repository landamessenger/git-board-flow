import { PatchSummary } from "../../../data/graph/ai_responses";
import { Ai } from "../../../data/model/ai";
import { Execution } from "../../../data/model/execution";
import { Result } from "../../../data/model/result";
import { AiRepository } from "../../../data/repository/ai_repository";
import { IssueRepository } from "../../../data/repository/issue_repository";
import { ProjectRepository } from "../../../data/repository/project_repository";
import { PullRequestRepository } from "../../../data/repository/pull_request_repository";
import { logDebugError, logDebugInfo, logError } from "../../../utils/logger";
import { ParamUseCase } from "../../base/param_usecase";

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

            const currentProjectMembers = await this.projectRepository.getAllMembers(param.owner, param.tokens.token);
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

            const changesDescription = await this.processChanges(changes, param.ai, param.owner, param.repo, param.tokens.token, param.pullRequest.base);

            const descriptionPrompt = `this an issue descrition.
define a description for the pull request which closes the issue and avoid the use of titles (#, ##, ###).
just a text description:\n\n
${issueDescription}`;

            const currentDescription = await this.aiRepository.ask(
                param.ai,
                descriptionPrompt,
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

    private mergePatchSummaries(summaries: PatchSummary[]): PatchSummary[] {
        const mergedMap = new Map<string, PatchSummary>();

        for (const summary of summaries) {
            const existing = mergedMap.get(summary.filePath);
            if (existing) {
                // Merge with existing summary
                existing.summary = `${existing.summary}\n${summary.summary}`;
                existing.changes = [...new Set([...existing.changes, ...summary.changes])];
            } else {
                // Create new entry
                mergedMap.set(summary.filePath, {
                    filePath: summary.filePath,
                    summary: summary.summary,
                    changes: [...summary.changes]
                });
            }
        }

        return Array.from(mergedMap.values());
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

        output += `\n\n--- \n\n`;

        return output;
    }

    private async processFile(
        change: { filename: string; status: string; additions: number; deletions: number; patch?: string },
        ai: Ai,
        owner: string,
        repo: string,
        token: string,
        baseBranch: string
    ): Promise<PatchSummary[]> {
        if (!change.patch) {
            return [];
        }

        // Get the original file content
        const originalContent = await this.pullRequestRepository.getFileContent(
            owner,
            repo,
            change.filename,
            token,
            baseBranch
        );

        const filePrompt = `Analyze the following code changes and provide a summary in JSON format.

### **Guidelines**:
- Output must be a **valid JSON** object.
- Provide a high-level summary of the changes.
- List the key changes in detail.
- Pay attention to the file names, don't make mistakes with uppercase, lowercase, or underscores.
- Be careful when composing the response JSON, don't make mistakes with unnecessary commas.

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
- **Filename:** ${change.filename}
- **Status:** ${change.status}
- **Changes:** +${change.additions} / -${change.deletions}

### **Original File Content**:
\`\`\`
${originalContent}
\`\`\`

### **Patch**:
${change.patch}`;

        const response = await this.aiRepository.ask(ai, filePrompt);
        if (!response) {
            return [];
        }

        try {
            const cleanResponse = response.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
            const patchSummary: PatchSummary = JSON.parse(cleanResponse);
            return [patchSummary];
        } catch (error) {
            logDebugError(`Response: ${response}`);
            logError(`Error parsing JSON response: ${error}`);
            return [];
        }
    }

    private async processChanges(
        changes: { filename: string; status: string; additions: number; deletions: number; patch?: string }[],
        ai: Ai,
        owner: string,
        repo: string,
        token: string,
        baseBranch: string
    ): Promise<string> {
        logDebugInfo(`Processing ${changes.length} changes`);
        const fileDescriptions: PatchSummary[] = [];
        
        for (const change of changes) {
            try {
                logDebugInfo(`Processing changes for file ${change.filename}`);
                const shouldIgnoreFile = this.shouldIgnoreFile(change.filename, ai.getAiIgnoreFiles());
                if (shouldIgnoreFile) {
                    logDebugInfo(`File ${change.filename} should be ignored`);
                    continue;
                }

                const fileSummary = await this.processFile(change, ai, owner, repo, token, baseBranch);
                fileDescriptions.push(...fileSummary);
            } catch (error) {
                logError(error);
                throw new Error(`Error processing file ${change.filename}: ${error}`);
            }
        }

        // Merge PatchSummary objects for the same file
        const mergedFileDescriptions = this.mergePatchSummaries(fileDescriptions);

        // Group files by directory
        const groupedFiles = this.groupFilesByDirectory(mergedFileDescriptions);
        
        // Generate a structured description
        let description = '';
        
        // Add summary section if there are files
        if (mergedFileDescriptions.length > 0) {
            description += '## Summary of Changes\n\n';
            description += mergedFileDescriptions.map(file => 
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
}