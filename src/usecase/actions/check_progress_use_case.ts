import { Execution } from '../../data/model/execution';
import { Result } from '../../data/model/result';
import { logError, logInfo } from '../../utils/logger';
import { ParamUseCase } from '../base/param_usecase';
import { IssueRepository } from '../../data/repository/issue_repository';
import { BranchRepository } from '../../data/repository/branch_repository';
import { ProgressDetector } from '../../agent/reasoning/progress_detector/progress_detector';
import { ProgressDetectionOptions } from '../../agent/reasoning/progress_detector/types';

export class CheckProgressUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'CheckProgressUseCase';
    private issueRepository: IssueRepository = new IssueRepository();
    private branchRepository: BranchRepository = new BranchRepository();

    async invoke(param: Execution): Promise<Result[]> {
        logInfo(`Executing ${this.taskId}.`);

        const results: Result[] = [];

        try {
            // Check if AI configuration is available
            if (!param.ai || !param.ai.getOpenRouterModel() || !param.ai.getOpenRouterApiKey()) {
                logError(`Missing required AI configuration. Please provide OPENROUTER_API_KEY and OPENROUTER_MODEL.`);
                results.push(
                    new Result({
                        id: this.taskId,
                        success: false,
                        executed: true,
                        errors: [
                            `Missing required AI configuration. Please provide OPENROUTER_API_KEY and OPENROUTER_MODEL.`,
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

            // Get branch - use commit.branch if available, otherwise try to determine from issue
            let branch: string | undefined = param.commit.branch;
            
            // If no branch in commit, try to get it from issue branch pattern
            if (!branch) {
                // Try to construct branch name from issue type and number
                // This is a fallback - ideally branch should be provided
                const issueType = param.issueType;
                if (issueType && issueNumber !== -1) {
                    if (issueType === param.branches.featureTree) {
                        branch = `${param.branches.featureTree}/${issueNumber}`;
                    } else if (issueType === param.branches.bugfixTree) {
                        branch = `${param.branches.bugfixTree}/${issueNumber}`;
                    } else if (issueType === param.branches.docsTree) {
                        branch = `${param.branches.docsTree}/${issueNumber}`;
                    } else if (issueType === param.branches.choreTree) {
                        branch = `${param.branches.choreTree}/${issueNumber}`;
                    }
                }
            }

            if (!branch) {
                logError(`Could not determine branch for issue #${issueNumber}. Please provide branch information.`);
                results.push(
                    new Result({
                        id: this.taskId,
                        success: false,
                        executed: true,
                        errors: [
                            `Could not determine branch for issue #${issueNumber}. Please provide branch information.`,
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

                changedFiles = changes.files.map(file => ({
                    filename: file.filename,
                    status: file.status as 'added' | 'modified' | 'removed' | 'renamed',
                    additions: file.additions,
                    deletions: file.deletions,
                    patch: file.patch
                }));

                logInfo(`📄 Found ${changedFiles.length} changed file(s)`);
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

            // Create ProgressDetector options
            const detectorOptions: ProgressDetectionOptions = {
                model: param.ai.getOpenRouterModel(),
                apiKey: param.ai.getOpenRouterApiKey(),
                personalAccessToken: param.tokens.token,
                maxTurns: 20,
                repositoryOwner: param.owner,
                repositoryName: param.repo,
                repositoryBranch: branch,
                developmentBranch: developmentBranch,
                issueNumber: issueNumber,
                issueDescription: issueDescription,
                changedFiles: changedFiles
            };

            // Detect progress
            logInfo(`🤖 Analyzing progress using AI...`);
            const detector = new ProgressDetector(detectorOptions);
            const progressResult = await detector.detectProgress(
                `Analyze the progress of issue #${issueNumber} based on the changes made in branch ${branch} compared to ${developmentBranch}.`
            );

            logInfo(`✅ Progress detection completed: ${progressResult.progress}%`);

            results.push(
                new Result({
                    id: this.taskId,
                    success: true,
                    executed: true,
                    steps: [
                        `Progress for issue #${issueNumber}: ${progressResult.progress}%`,
                        progressResult.summary
                    ],
                    payload: {
                        progress: progressResult.progress,
                        summary: progressResult.summary,
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
}

