import { Execution } from '../../data/model/execution';
import { Result } from '../../data/model/result';
import { logError, logInfo, logDebugInfo } from '../../utils/logger';
import { ParamUseCase } from '../base/param_usecase';
import { IssueRepository } from '../../data/repository/issue_repository';
import { BranchRepository } from '../../data/repository/branch_repository';
import { AiRepository, OPENCODE_AGENT_PLAN } from '../../data/repository/ai_repository';

const PROGRESS_RESPONSE_SCHEMA = {
    type: 'object',
    properties: {
        progress: { type: 'number', description: 'Completion percentage 0-100' },
        summary: { type: 'string', description: 'Short explanation of the assessment' },
    },
    required: ['progress', 'summary'],
    additionalProperties: false,
} as const;

export class CheckProgressUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'CheckProgressUseCase';
    private issueRepository: IssueRepository = new IssueRepository();
    private branchRepository: BranchRepository = new BranchRepository();
    private aiRepository: AiRepository = new AiRepository();

    async invoke(param: Execution): Promise<Result[]> {
        logInfo(`Executing ${this.taskId}.`);

        const results: Result[] = [];

        try {
            // Check if AI configuration is available
            if (!param.ai || !param.ai.getOpencodeModel() || !param.ai.getOpencodeServerUrl()) {
                logError(`Missing required AI configuration. Please provide OPENCODE_SERVER_URL and OPENCODE_MODEL.`);
                results.push(
                    new Result({
                        id: this.taskId,
                        success: false,
                        executed: true,
                        errors: [
                            `Missing required AI configuration. Please provide OPENCODE_SERVER_URL and OPENCODE_MODEL.`,
                        ],
                    })
                );
                return results;
            }

            const ignoreFiles = param.ai.getAiIgnoreFiles();
            logInfo(`🔍 Ignore patterns: ${ignoreFiles.length > 0 ? ignoreFiles.join(', ') : 'none'}`);

            // Get issue number
            const issueNumber = param.issueNumber;
            if (issueNumber === -1) {
                logError(`Issue number not found. Cannot check progress without an issue number.`);
                results.push(
                    new Result({
                        id: this.taskId,
                        success: false,
                        executed: true,
                        errors: [
                            `Issue number not found. Cannot check progress without an issue number.`,
                        ],
                    })
                );
                return results;
            }

            logInfo(`📋 Checking progress for issue #${issueNumber}`);

            // Get issue description
            const issueDescription = await this.issueRepository.getDescription(
                param.owner,
                param.repo,
                issueNumber,
                param.tokens.token
            );

            if (!issueDescription) {
                logError(`Could not retrieve issue description for issue #${issueNumber}`);
                results.push(
                    new Result({
                        id: this.taskId,
                        success: false,
                        executed: true,
                        errors: [
                            `Could not retrieve issue description for issue #${issueNumber}`,
                        ],
                    })
                );
                return results;
            }

            // Get branch - use commit.branch if available, otherwise search for branch by issue number
            let branch: string | undefined = param.commit.branch;
            
            // If no branch in commit, search for branch matching issue number pattern
            if (!branch) {
                logInfo(`📦 Searching for branch related to issue #${issueNumber}...`);
                
                const branchTypes = [
                    param.branches.featureTree,
                    param.branches.bugfixTree,
                    param.branches.docsTree,
                    param.branches.choreTree,
                    param.branches.hotfixTree,
                    param.branches.releaseTree,
                ];

                const branches = await this.branchRepository.getListOfBranches(
                    param.owner,
                    param.repo,
                    param.tokens.token,
                );

                // Search for branch matching the pattern: ${type}/${issueNumber}-
                for (const type of branchTypes) {
                    const prefix = `${type}/${issueNumber}-`;
                    const matchingBranch = branches.find(b => b.indexOf(prefix) > -1);
                    if (matchingBranch) {
                        branch = matchingBranch;
                        logInfo(`✅ Found branch: ${branch}`);
                        break;
                    }
                }
            }

            if (!branch) {
                logError(`Could not find branch for issue #${issueNumber}. Please ensure a branch exists with pattern: feature/${issueNumber}-*, bugfix/${issueNumber}-*, docs/${issueNumber}-*, or chore/${issueNumber}-*`);
                results.push(
                    new Result({
                        id: this.taskId,
                        success: false,
                        executed: true,
                        errors: [
                            `Could not find branch for issue #${issueNumber}. Please ensure a branch exists with pattern: feature/${issueNumber}-*, bugfix/${issueNumber}-*, docs/${issueNumber}-*, or chore/${issueNumber}-*`,
                        ],
                    })
                );
                return results;
            }

            // Get development branch
            const developmentBranch = param.branches.development || 'develop';

            logInfo(`📦 Comparing branch ${branch} with ${developmentBranch}`);

            // Get changed files between branch and development branch
            let changedFiles: Array<{
                filename: string;
                status: 'added' | 'modified' | 'removed' | 'renamed';
                additions?: number;
                deletions?: number;
                patch?: string;
            }> = [];

            try {
                const changes = await this.branchRepository.getChanges(
                    param.owner,
                    param.repo,
                    branch,
                    developmentBranch,
                    param.tokens.token
                );

                const allFiles = changes.files.map(file => ({
                    filename: file.filename,
                    status: file.status as 'added' | 'modified' | 'removed' | 'renamed',
                    additions: file.additions,
                    deletions: file.deletions,
                    patch: file.patch
                }));

                // Debug: show first few files being checked
                if (allFiles.length > 0) {
                    logDebugInfo(`Checking ${allFiles.length} files against ${ignoreFiles.length} ignore patterns`);
                    const sampleFiles = allFiles.slice(0, 5).map(f => f.filename);
                    logDebugInfo(`Sample files: ${sampleFiles.join(', ')}`);
                }

                changedFiles = allFiles.filter(file => {
                    const shouldIgnore = this.shouldIgnoreFile(file.filename, ignoreFiles);
                    if (shouldIgnore) {
                        logDebugInfo(`⏭️  Ignoring file: ${file.filename}`);
                    }
                    return !shouldIgnore;
                });

                const ignoredCount = allFiles.length - changedFiles.length;
                if (ignoredCount > 0) {
                    logInfo(`📄 Found ${changedFiles.length} changed file(s) (${ignoredCount} ignored)`);
                } else {
                    logInfo(`📄 Found ${changedFiles.length} changed file(s)`);
                }
            } catch (error) {
                logError(`Error getting changed files: ${JSON.stringify(error, null, 2)}`);
                results.push(
                    new Result({
                        id: this.taskId,
                        success: false,
                        executed: true,
                        errors: [
                            `Error getting changed files: ${JSON.stringify(error, null, 2)}`,
                        ],
                    })
                );
                return results;
            }

            // If no files changed, progress is 0%
            if (changedFiles.length === 0) {
                logInfo(`📊 No files changed. Progress: 0%`);
                results.push(
                    new Result({
                        id: this.taskId,
                        success: true,
                        executed: true,
                        steps: [
                            `No files have been changed yet. Progress: 0%`,
                        ],
                        payload: {
                            progress: 0,
                            summary: 'No files have been changed yet.',
                            issueNumber,
                            branch,
                            changedFilesCount: 0
                        }
                    })
                );
                return results;
            }

            const prompt = this.buildProgressPrompt(
                issueNumber,
                issueDescription,
                branch,
                developmentBranch,
                changedFiles
            );

            logInfo(`🤖 Analyzing progress using OpenCode Plan agent...`);
            const agentResponse = await this.aiRepository.askAgent(
                param.ai,
                OPENCODE_AGENT_PLAN,
                prompt,
                {
                    expectJson: true,
                    schema: PROGRESS_RESPONSE_SCHEMA as unknown as Record<string, unknown>,
                    schemaName: 'progress_response',
                    includeReasoning: true,
                }
            );

            const progress = agentResponse && typeof agentResponse === 'object' && typeof (agentResponse as Record<string, unknown>).progress === 'number'
                ? Math.min(100, Math.max(0, Math.round((agentResponse as Record<string, unknown>).progress as number)))
                : 0;
            const summary =
                agentResponse && typeof agentResponse === 'object' && typeof (agentResponse as Record<string, unknown>).summary === 'string'
                    ? String((agentResponse as Record<string, unknown>).summary)
                    : 'Unable to determine progress.';
            const reasoning =
                agentResponse && typeof agentResponse === 'object' && typeof (agentResponse as Record<string, unknown>).reasoning === 'string'
                    ? String((agentResponse as Record<string, unknown>).reasoning).trim()
                    : '';

            logInfo(`✅ Progress detection completed: ${progress}%`);

            const steps: string[] = [
                `Progress for issue #${issueNumber}: ${progress}%`,
                summary,
            ];
            if (reasoning) {
                steps.push(`**Reasoning:**\n\n${reasoning}`);
            }

            results.push(
                new Result({
                    id: this.taskId,
                    success: true,
                    executed: true,
                    steps,
                    payload: {
                        progress,
                        summary,
                        reasoning: reasoning || undefined,
                        issueNumber,
                        branch,
                        developmentBranch,
                        changedFilesCount: changedFiles.length
                    }
                })
            );

        } catch (error) {
            logError(`Error in ${this.taskId}: ${JSON.stringify(error, null, 2)}`);
            results.push(
                new Result({
                    id: this.taskId,
                    success: false,
                    executed: true,
                    errors: [
                        `Error in ${this.taskId}: ${JSON.stringify(error, null, 2)}`,
                    ],
                })
            );
        }

        return results;
    }

    private buildProgressPrompt(
        issueNumber: number,
        issueDescription: string,
        branch: string,
        developmentBranch: string,
        changedFiles: Array<{ filename: string; status: string; additions?: number; deletions?: number; patch?: string }>
    ): string {
        const fileList = changedFiles
            .map((f) => `- ${f.filename} (${f.status}${f.additions != null ? `, +${f.additions}` : ''}${f.deletions != null ? `/-${f.deletions}` : ''})`)
            .join('\n');
        const patchesSnippet = changedFiles
            .filter((f) => f.patch)
            .slice(0, 15)
            .map((f) => `### ${f.filename}\n\`\`\`diff\n${(f.patch ?? '').slice(0, 2000)}\n\`\`\``)
            .join('\n\n');
        return `Assess the progress of issue #${issueNumber} based on the branch "${branch}" compared to "${developmentBranch}".

**Issue description:**
${issueDescription}

**Changed files:**
${fileList}

**Patch excerpts (for context):**
${patchesSnippet}

Respond with a JSON object: { "progress": <number 0-100>, "summary": "<short explanation>" }.`;
    }

    /**
     * Check if a file should be ignored based on ignore patterns
     * This method matches the implementation in FileRepository.shouldIgnoreFile
     */
    private shouldIgnoreFile(filename: string, ignorePatterns: string[]): boolean {
        // First check for .DS_Store
        if (filename.endsWith('.DS_Store')) {
            return true;
        }

        if (ignorePatterns.length === 0) {
            return false;
        }

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
}

