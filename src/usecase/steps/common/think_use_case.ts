import { Execution } from '../../../data/model/execution';
import { Result } from '../../../data/model/result';
import { FileRepository } from '../../../data/repository/file_repository';
import { IssueRepository } from '../../../data/repository/issue_repository';
import { logDebugInfo, logError, logInfo } from '../../../utils/logger';
import { ReasoningVisualizer } from '../../../utils/reasoning_visualizer';
import { ParamUseCase } from '../../base/param_usecase';

export class ThinkUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'ThinkUseCase';
    private fileRepository: FileRepository = new FileRepository();
    private issueRepository: IssueRepository = new IssueRepository();
    
    async invoke(param: Execution): Promise<Result[]> {
        const visualizer = new ReasoningVisualizer();
        const results: Result[] = [];

        try {
            const description = await this.issueRepository.getDescription(
                param.owner,
                param.repo,
                param.issueNumber,
                param.tokens.token
            ) ?? '';

            let question = '';
            if (param.issue.isIssueComment) {
                question = param.issue.commentBody || '';
            } else if (param.pullRequest.isPullRequestReviewComment) {
                question = param.pullRequest.commentBody || '';
            } else if (param.issue.isIssue) {
                question = description;
            } else if (param.singleAction.isThinkAction) {
                // For CLI usage, get question from comment body if available
                // This handles the case when think is called as single-action
                const commentBody = param.issue.commentBody || param.inputs?.comment?.body || '';
                if (commentBody) {
                    question = commentBody;
                } else {
                    question = description || '';
                }
            }

            if (!question || question.length === 0) {
                if (!param.singleAction.isThinkAction) {
                    results.push(
                        new Result({
                            id: this.taskId,
                            success: false,
                            executed: false,
                            errors: ['No question or prompt provided.'],
                        })
                    );
                    return results;
                }
            }

            if (param.ai.getOpenRouterModel().length === 0 || param.ai.getOpenRouterApiKey().length === 0) {
                results.push(
                    new Result({
                        id: this.taskId,
                        success: false,
                        executed: false,
                        errors: ['OpenRouter model or API key not found.'],
                    })
                );
                return results;
            }

            // Show header with task
            visualizer.showHeader(question || description || 'AI Reasoning');
            
            if (question.length === 0 || !question.includes(`@${param.tokenUser}`)) {
                logInfo(`🔎 Comment body is empty or does not include @${param.tokenUser}`);
                results.push(
                    new Result({
                        id: this.taskId,
                        success: true,
                        executed: false,
                    })
                );
                return results;
            } else {
                question = question.replace(`@${param.tokenUser}`, '').trim();
            }

            // Get full repository content
            logInfo(`📚 Loading repository content for ${param.owner}/${param.repo}/${param.commit.branch}`);
            const repositoryFiles = await this.fileRepository.getRepositoryContent(
                param.owner,
                param.repo,
                param.tokens.token,
                param.commit.branch,
                param.ai.getAiIgnoreFiles(),
                (fileName: string) => {
                    // logDebugInfo(`Loading: ${fileName}`)
                },
                (fileName: string) => {
                    // logDebugInfo(`Ignoring: ${fileName}`)
                }
            );

            logInfo(`📚 Loaded ${repositoryFiles.size} files from repository`);

            

        } catch (error) {
            logError(`Error in ThinkUseCase: ${error}`);
            results.push(
                new Result({
                    id: this.taskId,
                    success: false,
                    executed: false,
                    errors: [`Error in ThinkUseCase: ${error}`],
                })
            );
        }
        return results;
    }

    private async getIssueDescription(param: Execution): Promise<string | null> {
        try {
            const description = await this.issueRepository.getDescription(
                param.owner,
                param.repo,
                param.issueNumber,
                param.tokens.token
            );
            return description ?? null;
        } catch (error) {
            logError(`Error getting issue description: ${error}`);
            return null;
        }
    }
}
