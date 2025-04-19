"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdatePullRequestDescriptionUseCase = void 0;
const result_1 = require("../../../data/model/result");
const ai_repository_1 = require("../../../data/repository/ai_repository");
const file_repository_1 = require("../../../data/repository/file_repository");
const issue_repository_1 = require("../../../data/repository/issue_repository");
const project_repository_1 = require("../../../data/repository/project_repository");
const pull_request_repository_1 = require("../../../data/repository/pull_request_repository");
const logger_1 = require("../../../utils/logger");
class UpdatePullRequestDescriptionUseCase {
    constructor() {
        this.taskId = 'UpdatePullRequestDescriptionUseCase';
        this.aiRepository = new ai_repository_1.AiRepository();
        this.pullRequestRepository = new pull_request_repository_1.PullRequestRepository();
        this.fileRepository = new file_repository_1.FileRepository();
        this.issueRepository = new issue_repository_1.IssueRepository();
        this.projectRepository = new project_repository_1.ProjectRepository();
    }
    async invoke(param) {
        (0, logger_1.logDebugInfo)(`Executing ${this.taskId}.`);
        const result = [];
        try {
            const prNumber = param.pullRequest.number;
            const issueDescription = await this.issueRepository.getIssueDescription(param.owner, param.repo, param.issueNumber, param.tokens.token);
            if (issueDescription.length === 0) {
                result.push(new result_1.Result({
                    id: this.taskId,
                    success: false,
                    executed: false,
                    steps: [
                        `No issue description found. Skipping update pull request description.`
                    ]
                }));
                return result;
            }
            const currentProjectMembers = await this.projectRepository.getAllMembers(param.owner, param.tokens.token);
            const pullRequestCreatorIsTeamMember = param.pullRequest.creator.length > 0
                && currentProjectMembers.indexOf(param.pullRequest.creator) > -1;
            if (!pullRequestCreatorIsTeamMember && param.ai.getAiMembersOnly()) {
                result.push(new result_1.Result({
                    id: this.taskId,
                    success: false,
                    executed: false,
                    steps: [
                        `The pull request creator @${param.pullRequest.creator} is not a team member and \`AI members only\` is enabled. Skipping update pull request description.`
                    ]
                }));
                return result;
            }
            const changes = await this.pullRequestRepository.getPullRequestChanges(param.owner, param.repo, prNumber, param.tokens.token);
            const changesDescription = await this.processChanges(changes, param.ai, param.owner, param.repo, param.tokens.token, param.pullRequest.base);
            const descriptionPrompt = `this an issue descrition.
define a description for the pull request which closes the issue and avoid the use of titles (#, ##, ###).
just a text description:\n\n
${issueDescription}`;
            const currentDescription = await this.aiRepository.ask(param.ai, descriptionPrompt);
            // Update pull request description
            await this.pullRequestRepository.updateDescription(param.owner, param.repo, prNumber, `
#${param.issueNumber}

## What does this PR do?

${currentDescription}

${changesDescription}
`, param.tokens.token);
            result.push(new result_1.Result({
                id: this.taskId,
                success: true,
                executed: true,
                steps: [
                    `The description has been updated with AI-generated content.`
                ]
            }));
        }
        catch (error) {
            (0, logger_1.logError)(error);
            result.push(new result_1.Result({
                id: this.taskId,
                success: false,
                executed: true,
                steps: [
                    `Error updating pull request description: ${error}`
                ]
            }));
        }
        return result;
    }
    shouldIgnoreFile(filename, ignorePatterns) {
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
    mergePatchSummaries(summaries) {
        const mergedMap = new Map();
        for (const summary of summaries) {
            const existing = mergedMap.get(summary.filePath);
            if (existing) {
                // Merge with existing summary
                existing.summary = `${existing.summary}\n${summary.summary}`;
                existing.changes = [...new Set([...existing.changes, ...summary.changes])];
            }
            else {
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
    groupFilesByDirectory(files) {
        const groups = {
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
            }
            else {
                groups.root.push(file);
            }
        });
        return groups;
    }
    formatFileChanges(file) {
        let output = `#### \`${file.filePath}\`\n\n`;
        output += `${file.summary}\n\n`;
        if (file.changes.length > 0) {
            output += '**Changes:**\n';
            output += file.changes.map(change => `- ${change}`).join('\n');
        }
        output += `\n\n--- \n\n`;
        return output;
    }
    async processFile(change, ai, owner, repo, token, baseBranch) {
        if (!change.patch) {
            return [];
        }
        // Get the original file content
        const originalContent = await this.fileRepository.getFileContent(owner, repo, change.filename, token, baseBranch);
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
            const patchSummary = JSON.parse(cleanResponse);
            return [patchSummary];
        }
        catch (error) {
            (0, logger_1.logDebugError)(`Response: ${response}`);
            (0, logger_1.logError)(`Error parsing JSON response: ${error}`);
            return [];
        }
    }
    async processChanges(changes, ai, owner, repo, token, baseBranch) {
        (0, logger_1.logDebugInfo)(`Processing ${changes.length} changes`);
        const fileDescriptions = [];
        for (const change of changes) {
            try {
                (0, logger_1.logDebugInfo)(`Processing changes for file ${change.filename}`);
                const shouldIgnoreFile = this.shouldIgnoreFile(change.filename, ai.getAiIgnoreFiles());
                if (shouldIgnoreFile) {
                    (0, logger_1.logDebugInfo)(`File ${change.filename} should be ignored`);
                    continue;
                }
                const fileSummary = await this.processFile(change, ai, owner, repo, token, baseBranch);
                fileDescriptions.push(...fileSummary);
            }
            catch (error) {
                (0, logger_1.logError)(error);
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
            description += mergedFileDescriptions.map(file => `- **${file.filePath}**: ${file.summary}`).join('\n');
            description += '\n\n';
        }
        // Add detailed changes section
        description += '## Detailed Changes\n\n';
        // Process each directory group
        for (const [directory, files] of Object.entries(groupedFiles)) {
            if (directory === 'root') {
                // Files in root directory
                description += files.map(file => this.formatFileChanges(file)).join('\n\n') + `\n\n`;
            }
            else {
                // Files in subdirectories
                description += `### ${directory}\n\n`;
                description += files.map(file => this.formatFileChanges(file)).join('\n\n') + `\n\n`;
            }
        }
        return description;
    }
}
exports.UpdatePullRequestDescriptionUseCase = UpdatePullRequestDescriptionUseCase;
