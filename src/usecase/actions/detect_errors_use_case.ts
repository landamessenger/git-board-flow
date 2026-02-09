import { Execution } from '../../data/model/execution';
import { Result } from '../../data/model/result';
import { logError, logInfo } from '../../utils/logger';
import { ParamUseCase } from '../base/param_usecase';
import { IssueRepository } from '../../data/repository/issue_repository';
import { BranchRepository } from '../../data/repository/branch_repository';
import { AiRepository, OPENCODE_AGENT_PLAN } from '../../data/repository/ai_repository';

export class DetectErrorsUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'DetectErrorsUseCase';
    private issueRepository: IssueRepository = new IssueRepository();
    private branchRepository: BranchRepository = new BranchRepository();
    private aiRepository: AiRepository = new AiRepository();

    async invoke(param: Execution): Promise<Result[]> {
        logInfo(`Executing ${this.taskId}.`);

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

            let branch: string | undefined = param.commit.branch;
            if (!branch) {
                const branchTypes = [
                    param.branches.featureTree,
                    param.branches.bugfixTree,
                    param.branches.docsTree,
                    param.branches.choreTree,
                ];
                const branches = await this.branchRepository.getListOfBranches(
                    param.owner,
                    param.repo,
                    param.tokens.token
                );
                for (const type of branchTypes) {
                    const prefix = `${type}/${issueNumber}-`;
                    const found = branches.find((b) => b.indexOf(prefix) > -1);
                    if (found) {
                        branch = found;
                        break;
                    }
                }
            }

            const developmentBranch = param.branches.development || 'develop';
            if (!branch) {
                results.push(
                    new Result({
                        id: this.taskId,
                        success: false,
                        executed: true,
                        errors: [`No branch found for issue #${issueNumber}.`],
                    })
                );
                return results;
            }

            const changes = await this.branchRepository.getChanges(
                param.owner,
                param.repo,
                branch,
                developmentBranch,
                param.tokens.token
            );

            const prompt = `Review the code changes in branch "${branch}" compared to "${developmentBranch}" and identify potential errors, bugs, or issues.

**Changed files and patches:**
${changes.files
    .slice(0, 30)
    .map(
        (f) =>
            `### ${f.filename} (${f.status})\n\`\`\`diff\n${(f.patch ?? '').slice(0, 1500)}\n\`\`\``
    )
    .join('\n\n')}

List potential errors, bugs, or code quality issues. For each: file (if relevant), brief description, and severity if obvious. Use clear bullet points or numbered list.`;

            logInfo(`🤖 Detecting errors using OpenCode Plan agent...`);
            const response = await this.aiRepository.askAgent(
                param.ai,
                OPENCODE_AGENT_PLAN,
                prompt
            );

            const report =
                typeof response === 'string'
                    ? response
                    : (response && String((response as Record<string, unknown>).report)) || 'No response.';

            results.push(
                new Result({
                    id: this.taskId,
                    success: true,
                    executed: true,
                    steps: ['Error detection completed (OpenCode Plan agent).', report],
                    payload: { issueNumber, branch, developmentBranch, report },
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
