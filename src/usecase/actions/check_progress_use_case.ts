import { Ai } from '../../data/model/ai';
import { Execution } from '../../data/model/execution';
import { Result } from '../../data/model/result';
import { logError, logInfo } from '../../utils/logger';
import { getTaskEmoji } from '../../utils/task_emoji';
import { ParamUseCase } from '../base/param_usecase';
import { IssueRepository, PROGRESS_LABEL_PATTERN } from '../../data/repository/issue_repository';
import { BranchRepository } from '../../data/repository/branch_repository';
import { PullRequestRepository } from '../../data/repository/pull_request_repository';
import { AiRepository, OPENCODE_AGENT_PLAN } from '../../data/repository/ai_repository';
import { getCheckProgressPrompt } from '../../prompts';
import { OPENCODE_PROJECT_CONTEXT_INSTRUCTION } from '../../utils/opencode_project_context_instruction';

const PROGRESS_RESPONSE_SCHEMA = {
    type: 'object',
    properties: {
        progress: { type: 'number', description: 'Completion percentage 0-100' },
        summary: { type: 'string', description: 'Short explanation of the assessment' },
        remaining: { type: 'string', description: 'When progress < 100: what is left to do to reach 100%. Omit or empty when progress is 100.' },
    },
    required: ['progress', 'summary'],
    additionalProperties: false,
} as const;

interface ProgressAttemptResult {
    progress: number;
    summary: string;
    reasoning: string;
    remaining: string;
}

export class CheckProgressUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'CheckProgressUseCase';
    private issueRepository: IssueRepository = new IssueRepository();
    private branchRepository: BranchRepository = new BranchRepository();
    private pullRequestRepository: PullRequestRepository = new PullRequestRepository();
    private aiRepository: AiRepository = new AiRepository();

    async invoke(param: Execution): Promise<Result[]> {
        logInfo(`${getTaskEmoji(this.taskId)} Executing ${this.taskId}.`);

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

            // Get development (parent) branch – we pass this so the OpenCode agent can compute the diff
            const developmentBranch = param.branches.development || 'develop';

            logInfo(`📦 Progress will be assessed from workspace diff: base branch "${developmentBranch}", current branch "${branch}" (OpenCode agent will run git diff).`);

            const prompt = getCheckProgressPrompt({
                projectContextInstruction: OPENCODE_PROJECT_CONTEXT_INSTRUCTION,
                issueNumber: String(issueNumber),
                issueDescription,
                baseBranch: developmentBranch,
                currentBranch: branch,
            });

            logInfo('🤖 Analyzing progress using OpenCode Plan agent...');
            const attemptResult = await this.fetchProgressAttempt(param.ai, prompt);
            const progress = attemptResult.progress;
            const summary = attemptResult.summary;
            const reasoning = attemptResult.reasoning;
            const remaining = attemptResult.remaining;

            if (progress > 0) {
                logInfo(`✅ Progress detection completed: ${progress}%`);
            }

            const progressFailed = progress === 0;
            if (progressFailed) {
                logError('Progress detection returned 0%. This may be due to a model error or no changes detected.');
                results.push(
                    new Result({
                        id: this.taskId,
                        success: false,
                        executed: true,
                        steps: [
                            `Progress for issue #${issueNumber}: 0%`,
                            summary,
                        ],
                        errors: [
                            'Progress detection returned 0%. This may be due to a model error or no changes detected. Consider re-running the check.',
                        ],
                        payload: {
                            progress: 0,
                            summary,
                            reasoning: reasoning || undefined,
                            issueNumber,
                            branch,
                            developmentBranch,
                        },
                    })
                );
                return results;
            }

            const roundedProgress = Math.min(100, Math.max(0, Math.round(progress / 5) * 5));
            await this.issueRepository.setProgressLabel(
                param.owner,
                param.repo,
                issueNumber,
                progress,
                param.tokens.token,
            );

            const openPrNumbers = await this.pullRequestRepository.getOpenPullRequestNumbersByHeadBranch(
                param.owner,
                param.repo,
                branch,
                param.tokens.token,
            );
            const newProgressLabel = `${roundedProgress}%`;
            for (const prNumber of openPrNumbers) {
                const prLabels = await this.issueRepository.getLabels(
                    param.owner,
                    param.repo,
                    prNumber,
                    param.tokens.token,
                );
                const withoutProgress = prLabels.filter((name) => !PROGRESS_LABEL_PATTERN.test(name));
                const nextLabels = withoutProgress.includes(newProgressLabel)
                    ? withoutProgress
                    : [...withoutProgress, newProgressLabel];
                await this.issueRepository.setLabels(
                    param.owner,
                    param.repo,
                    prNumber,
                    nextLabels,
                    param.tokens.token,
                );
                logInfo(`Progress label set to ${newProgressLabel} on PR #${prNumber}.`);
            }

            let summaryMessage = `**Analysis**: ${summary}`;
            if (progress < 100 && remaining) {
                summaryMessage += `\n\n## 🤷 What's left to reach 100%\n\n${remaining}`;
            }
            if (reasoning) {
                const truncationNote = this.isReasoningLikelyTruncated(reasoning)
                    ? '\n\n_Reasoning may be truncated by the model._'
                    : '';
                summaryMessage += `\n\n## 🧠 Reasoning\n${reasoning}${truncationNote}`;
            }

            const steps: string[] = [
                `Progress updated to: ${progress}%`,
                summaryMessage,
            ];

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
                        remaining: progress < 100 && remaining ? remaining : undefined,
                        issueNumber,
                        branch,
                        developmentBranch
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

    /**
     * Calls the OpenCode agent once and returns parsed progress, summary, and reasoning.
     * HTTP-level retries are handled by AiRepository (OPENCODE_MAX_RETRIES).
     */
    private async fetchProgressAttempt(ai: Ai, prompt: string): Promise<ProgressAttemptResult> {
        const agentResponse = await this.aiRepository.askAgent(
            ai,
            OPENCODE_AGENT_PLAN,
            prompt,
            {
                expectJson: true,
                schema: PROGRESS_RESPONSE_SCHEMA as unknown as Record<string, unknown>,
                schemaName: 'progress_response',
                includeReasoning: true,
            }
        );
        const progress =
            agentResponse && typeof agentResponse === 'object' && typeof (agentResponse as Record<string, unknown>).progress === 'number'
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
        const remaining =
            agentResponse && typeof agentResponse === 'object' && typeof (agentResponse as Record<string, unknown>).remaining === 'string'
                ? String((agentResponse as Record<string, unknown>).remaining).trim()
                : '';
        return { progress, summary, reasoning, remaining };
    }

    /**
     * Returns true if the reasoning text looks truncated (e.g. ends with ":" or trailing spaces,
     * or no sentence-ending punctuation), so we can append a note in the comment.
     */
    private isReasoningLikelyTruncated(reasoning: string): boolean {
        const t = reasoning.trim();
        if (t.length === 0) return false;
        const lastChar = t.slice(-1);
        const sentenceEnd = /[.!?\n]$/;
        const endsWithColonOrSpace = /[:\s]$/.test(t);
        return endsWithColonOrSpace || !sentenceEnd.test(lastChar);
    }
}

