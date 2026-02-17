/**
 * When a question or help issue is newly opened, posts an initial helpful reply
 * based on the issue description (OpenCode Plan agent). The user can still
 * @mention the bot later for follow-up answers (ThinkUseCase).
 */

import { Execution } from '../../../data/model/execution';
import { Result } from '../../../data/model/result';
import { AiRepository, OPENCODE_AGENT_PLAN, THINK_RESPONSE_SCHEMA } from '../../../data/repository/ai_repository';
import { IssueRepository } from '../../../data/repository/issue_repository';
import { getAnswerIssueHelpPrompt } from '../../../prompts';
import { logDebugInfo, logError, logInfo } from '../../../utils/logger';
import { OPENCODE_PROJECT_CONTEXT_INSTRUCTION } from '../../../utils/opencode_project_context_instruction';
import { getTaskEmoji } from '../../../utils/task_emoji';
import { ParamUseCase } from '../../base/param_usecase';

export class AnswerIssueHelpUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'AnswerIssueHelpUseCase';
    private aiRepository: AiRepository = new AiRepository();
    private issueRepository: IssueRepository = new IssueRepository();

    async invoke(param: Execution): Promise<Result[]> {
        const results: Result[] = [];

        logInfo('AnswerIssueHelp: checking if initial help reply is needed (AI).');

        try {
            if (!param.issue.opened) {
                results.push(
                    new Result({
                        id: this.taskId,
                        success: true,
                        executed: false,
                    })
                );
                return results;
            }

            if (!param.labels.isQuestion && !param.labels.isHelp) {
                results.push(
                    new Result({
                        id: this.taskId,
                        success: true,
                        executed: false,
                    })
                );
                return results;
            }

            if (!param.ai?.getOpencodeModel()?.trim() || !param.ai?.getOpencodeServerUrl()?.trim()) {
                logInfo('OpenCode not configured; skipping initial help reply.');
                results.push(
                    new Result({
                        id: this.taskId,
                        success: true,
                        executed: false,
                    })
                );
                return results;
            }

            const issueNumber = param.issue.number;
            if (issueNumber <= 0) {
                results.push(
                    new Result({
                        id: this.taskId,
                        success: true,
                        executed: false,
                    })
                );
                return results;
            }

            const description = (param.issue.body ?? '').trim();
            if (!description) {
                logInfo('Issue has no body; skipping initial help reply.');
                results.push(
                    new Result({
                        id: this.taskId,
                        success: true,
                        executed: false,
                    })
                );
                return results;
            }

            logInfo(`${getTaskEmoji(this.taskId)} Posting initial help reply for question/help issue #${issueNumber}.`);

            const prompt = getAnswerIssueHelpPrompt({
                description,
                projectContextInstruction: OPENCODE_PROJECT_CONTEXT_INSTRUCTION,
            });

            logDebugInfo(`AnswerIssueHelp: prompt length=${prompt.length}, issue description length=${description.length}. Calling OpenCode Plan agent.`);
            const response = await this.aiRepository.askAgent(param.ai, OPENCODE_AGENT_PLAN, prompt, {
                expectJson: true,
                schema: THINK_RESPONSE_SCHEMA as unknown as Record<string, unknown>,
                schemaName: 'think_response',
            });

            const answer =
                response != null &&
                typeof response === 'object' &&
                typeof (response as Record<string, unknown>).answer === 'string'
                    ? ((response as Record<string, unknown>).answer as string).trim()
                    : '';

            logDebugInfo(`AnswerIssueHelp: OpenCode response. Answer length=${answer.length}. Full answer:\n${answer}`);

            if (!answer) {
                logError('OpenCode returned no answer for initial help.');
                results.push(
                    new Result({
                        id: this.taskId,
                        success: false,
                        executed: true,
                        errors: ['OpenCode returned no answer for initial help.'],
                    })
                );
                return results;
            }

            await this.issueRepository.addComment(
                param.owner,
                param.repo,
                issueNumber,
                answer,
                param.tokens.token
            );
            logInfo(`Initial help reply posted to issue #${issueNumber}.`);

            results.push(
                new Result({
                    id: this.taskId,
                    success: true,
                    executed: true,
                })
            );
        } catch (error) {
            logError(`Error in ${this.taskId}: ${error}`);
            results.push(
                new Result({
                    id: this.taskId,
                    success: false,
                    executed: true,
                    errors: [`Error in ${this.taskId}: ${error}`],
                })
            );
        }

        return results;
    }
}
