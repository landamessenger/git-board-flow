import { Ai } from '../../data/model/ai';
import { Execution } from '../../data/model/execution';
import { Result } from '../../data/model/result';
import { logError, logInfo } from '../../utils/logger';
import { ParamUseCase } from '../base/param_usecase';
import { IssueRepository, PROGRESS_LABEL_PATTERN } from '../../data/repository/issue_repository';
import { BranchRepository } from '../../data/repository/branch_repository';
import { PullRequestRepository } from '../../data/repository/pull_request_repository';
import { AiRepository, OPENCODE_AGENT_PLAN } from '../../data/repository/ai_repository';

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

const MAX_PROGRESS_ATTEMPTS = 3;

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

            const prompt = this.buildProgressPrompt(issueNumber, issueDescription, branch, developmentBranch);

            let progress = 0;
            let summary = 'Unable to determine progress.';
            let reasoning = '';
            let remaining = '';

            for (let attempt = 1; attempt <= MAX_PROGRESS_ATTEMPTS; attempt++) {
                logInfo(`🤖 Analyzing progress using OpenCode Plan agent... (attempt ${attempt}/${MAX_PROGRESS_ATTEMPTS})`);
                const attemptResult = await this.fetchProgressAttempt(param.ai, prompt);
                progress = attemptResult.progress;
                summary = attemptResult.summary;
                reasoning = attemptResult.reasoning;
                remaining = attemptResult.remaining;
                if (progress > 0) {
                    logInfo(`✅ Progress detection completed: ${progress}%`);
                    break;
                }
                if (attempt < MAX_PROGRESS_ATTEMPTS) {
                    logInfo(`⚠️ Progress returned 0% (attempt ${attempt}/${MAX_PROGRESS_ATTEMPTS}), retrying...`);
                }
            }

            const progressFailedAfterRetries = progress === 0;
            if (progressFailedAfterRetries) {
                logError(`Progress detection failed: received 0% after ${MAX_PROGRESS_ATTEMPTS} attempts. This may be due to a model error.`);
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
                            `Progress detection failed: received 0% after ${MAX_PROGRESS_ATTEMPTS} attempts. This may be due to a model error. There are changes on the branch; consider re-running the check.`,
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
     * Used inside the retry loop when progress is 0%.
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
     * Builds the progress prompt for the OpenCode agent. We do not send the diff from our side:
     * we tell the agent the base (parent) branch and current branch so it can run `git diff`
     * in the workspace and compute the full diff itself.
     */
    private buildProgressPrompt(
        issueNumber: number,
        issueDescription: string,
        currentBranch: string,
        baseBranch: string
    ): string {
        return `You are in the repository workspace. Assess the progress of issue #${issueNumber} using the full diff between the base (parent) branch and the current branch.

**Branches:**
- **Base (parent) branch:** \`${baseBranch}\`
- **Current branch:** \`${currentBranch}\`

**Instructions:**
1. Get the full diff by running: \`git diff ${baseBranch}..${currentBranch}\` (or \`git diff ${baseBranch}...${currentBranch}\` for merge-base). If you cannot run shell commands, use whatever workspace tools you have to inspect changes between these branches.
2. Optionally confirm the current branch with \`git branch --show-current\` if needed.
3. Based on the full diff and the issue description below, assess completion progress (0-100%) and write a short summary.
4. If progress is below 100%, add a "remaining" field with a short description of what is left to do to complete the task (e.g. missing implementation, tests, docs). Omit "remaining" or leave empty when progress is 100%.

**Issue description:**
${issueDescription}

Respond with a single JSON object: { "progress": <number 0-100>, "summary": "<short explanation>", "remaining": "<what is left to reach 100%, only when progress < 100>" }.`;
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

