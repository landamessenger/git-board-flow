import { Execution } from '../../data/model/execution';
import { Result } from '../../data/model/result';
import { AiRepository, OPENCODE_AGENT_PLAN } from '../../data/repository/ai_repository';
import { IssueRepository } from '../../data/repository/issue_repository';
import { getRecommendStepsPrompt } from '../../prompts';
import { logError, logInfo } from '../../utils/logger';
import { OPENCODE_PROJECT_CONTEXT_INSTRUCTION } from '../../utils/opencode_project_context_instruction';
import { getTaskEmoji } from '../../utils/task_emoji';
import { ParamUseCase } from '../base/param_usecase';

export class RecommendStepsUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'RecommendStepsUseCase';
    private issueRepository: IssueRepository = new IssueRepository();
    private aiRepository: AiRepository = new AiRepository();

    async invoke(param: Execution): Promise<Result[]> {
        logInfo(`${getTaskEmoji(this.taskId)} Executing ${this.taskId}.`);

        const results: Result[] = [];

        try {
            if (!param.ai?.getOpencodeModel() || !param.ai?.getOpencodeServerUrl()) {
                results.push(
                    new Result({
                        id: this.taskId,
                        success: false,
                        executed: true,
                        errors: ['Missing OPENCODE_SERVER_URL and OPENCODE_MODEL.'],
                    })
                );
                return results;
            }

            const issueNumber = param.issueNumber;
            if (issueNumber === -1) {
                results.push(
                    new Result({
                        id: this.taskId,
                        success: false,
                        executed: true,
                        errors: ['Issue number not found.'],
                    })
                );
                return results;
            }

            const issueDescription = await this.issueRepository.getDescription(
                param.owner,
                param.repo,
                issueNumber,
                param.tokens.token
            );

            if (!issueDescription?.trim()) {
                results.push(
                    new Result({
                        id: this.taskId,
                        success: false,
                        executed: true,
                        errors: [`No description found for issue #${issueNumber}.`],
                    })
                );
                return results;
            }

            const prompt = getRecommendStepsPrompt({
                projectContextInstruction: OPENCODE_PROJECT_CONTEXT_INSTRUCTION,
                issueNumber: String(issueNumber),
                issueDescription,
            });

            logInfo(`🤖 Recommending steps using OpenCode Plan agent...`);
            const response = await this.aiRepository.askAgent(
                param.ai,
                OPENCODE_AGENT_PLAN,
                prompt
            );

            const steps =
                typeof response === 'string'
                    ? response
                    : (response && String((response as Record<string, unknown>).steps)) || 'No response.';

            results.push(
                new Result({
                    id: this.taskId,
                    success: true,
                    executed: true,
                    steps: ['Recommended steps (OpenCode Plan agent):', steps],
                    payload: { issueNumber, recommendedSteps: steps },
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
