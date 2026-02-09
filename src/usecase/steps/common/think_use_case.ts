import { Execution } from '../../../data/model/execution';
import { Result } from '../../../data/model/result';
import { AiRepository } from '../../../data/repository/ai_repository';
import { IssueRepository } from '../../../data/repository/issue_repository';
import { logError, logInfo } from '../../../utils/logger';
import { ParamUseCase } from '../../base/param_usecase';

export class ThinkUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'ThinkUseCase';
    private aiRepository: AiRepository = new AiRepository();
    private issueRepository: IssueRepository = new IssueRepository();

    async invoke(param: Execution): Promise<Result[]> {
        const results: Result[] = [];

        try {
            const commentBody =
                param.issue.isIssueComment
                    ? (param.issue.commentBody ?? '')
                    : param.pullRequest.isPullRequestReviewComment
                      ? (param.pullRequest.commentBody ?? '')
                      : '';

            if (!commentBody.trim()) {
                results.push(
                    new Result({
                        id: this.taskId,
                        success: true,
                        executed: false,
                    })
                );
                return results;
            }

            if (!param.tokenUser?.trim()) {
                logInfo('Bot username (tokenUser) not set; skipping Think response.');
                results.push(
                    new Result({
                        id: this.taskId,
                        success: true,
                        executed: false,
                    })
                );
                return results;
            }

            if (!commentBody.includes(`@${param.tokenUser}`)) {
                logInfo(`Comment does not mention @${param.tokenUser}; skipping.`);
                results.push(
                    new Result({
                        id: this.taskId,
                        success: true,
                        executed: false,
                    })
                );
                return results;
            }

            if (!param.ai.getOpencodeModel()?.trim() || !param.ai.getOpencodeServerUrl()?.trim()) {
                results.push(
                    new Result({
                        id: this.taskId,
                        success: false,
                        executed: false,
                        errors: ['OpenCode server URL or model not found.'],
                    })
                );
                return results;
            }

            const question = commentBody.replace(new RegExp(`@${param.tokenUser}`, 'gi'), '').trim();
            if (!question) {
                results.push(
                    new Result({
                        id: this.taskId,
                        success: true,
                        executed: false,
                    })
                );
                return results;
            }

            const issueNumberForContext =
                param.issue.isIssueComment ? param.issue.number : param.issueNumber;
            let issueDescription = '';
            if (issueNumberForContext > 0) {
                const desc = await this.issueRepository.getDescription(
                    param.owner,
                    param.repo,
                    issueNumberForContext,
                    param.tokens.token,
                );
                if (desc?.trim()) {
                    issueDescription = desc.trim();
                }
            }

            const contextBlock = issueDescription
                ? `\n\nContext (issue #${issueNumberForContext} description):\n${issueDescription}\n\n`
                : '\n\n';
            const prompt = `You are a helpful assistant. Answer the following question concisely, using the context below when relevant. Do not include the question in your response.${contextBlock}Question: ${question}`;
            const answer = await this.aiRepository.ask(param.ai, prompt);

            if (answer === undefined || !answer.trim()) {
                logError('OpenCode returned no answer for Think.');
                results.push(
                    new Result({
                        id: this.taskId,
                        success: false,
                        executed: true,
                        errors: ['OpenCode returned no answer.'],
                    })
                );
                return results;
            }

            const issueOrPrNumber = param.issue.isIssueComment
                ? param.issue.number
                : param.pullRequest.number;
            if (issueOrPrNumber <= 0) {
                logError('Issue or PR number not available for adding comment.');
                results.push(
                    new Result({
                        id: this.taskId,
                        success: false,
                        executed: true,
                        errors: ['Issue or PR number not available.'],
                    })
                );
                return results;
            }

            await this.issueRepository.addComment(
                param.owner,
                param.repo,
                issueOrPrNumber,
                answer.trim(),
                param.tokens.token,
            );
            logInfo(`Think response posted to ${param.issue.isIssueComment ? 'issue' : 'PR'} #${issueOrPrNumber}.`);

            results.push(
                new Result({
                    id: this.taskId,
                    success: true,
                    executed: true,
                })
            );
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
}
