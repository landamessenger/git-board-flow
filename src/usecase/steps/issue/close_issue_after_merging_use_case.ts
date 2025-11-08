import { Execution } from "../../../data/model/execution";
import { Result } from "../../../data/model/result";
import { IssueRepository } from "../../../data/repository/issue_repository";
import { SupabaseRepository } from "../../../data/repository/supabase_repository";
import { logError, logInfo } from "../../../utils/logger";
import { ParamUseCase } from "../../base/param_usecase";

export class CloseIssueAfterMergingUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'CloseIssueAfterMergingUseCase';
    
    private issueRepository = new IssueRepository();

    async invoke(param: Execution): Promise<Result[]> {
        logInfo(`Executing ${this.taskId}.`)

        let supabaseRepository: SupabaseRepository | undefined = undefined;
        if (param.supabaseConfig) {
            supabaseRepository = new SupabaseRepository(param.supabaseConfig);
        }

        const result: Result[] = []
        try {
            const closed = await this.issueRepository.closeIssue(
                param.owner,
                param.repo,
                param.issueNumber,
                param.tokens.token,
            );
            if (closed) {
                await this.issueRepository.addComment(
                    param.owner,
                    param.repo,
                    param.issueNumber,
                    `This issue was closed after merging #${param.pullRequest.number}.`,
                    param.tokens.token,
                )
                result.push(
                    new Result({
                        id: this.taskId,
                        success: true,
                        executed: true,
                        steps: [
                            `#${param.issueNumber} was automatically closed after merging this pull request.`
                        ]
                    })
                )

                result.push(
                    ...await this.removeBranches(
                        supabaseRepository,
                        param,
                        param.pullRequest.head.replace('refs/heads/', ''),
                    )
                );
            } else {
                result.push(
                    new Result({
                        id: this.taskId,
                        success: true,
                        executed: false,
                    })
                )
            }

        } catch (error) {
            result.push(
                new Result({
                    id: this.taskId,
                    success: false,
                    executed: true,
                    steps: [
                        `Tried to close issue #${param.issueNumber}, but there was a problem.`,
                    ],
                    error: error,
                })
            )
        }
        return result
    }

    private removeBranches = async (supabaseRepository: SupabaseRepository | undefined, param: Execution, branch: string) => {
        const result: Result[] = []
        if (!supabaseRepository) {
            return result;
        }
        try {
            await supabaseRepository.removeAIFileCacheByBranch(param.owner, param.repo, branch);
            result.push(
                new Result({
                    id: this.taskId,
                    success: true,
                    executed: true,
                    reminders: [
                        `AI index was removed from \`${branch}\`.`,
                    ]
                })
            )
        } catch (error) {
            logError(`Error removing AI cache: ${JSON.stringify(error, null, 2)}`);
            result.push(
                new Result({
                    id: this.taskId,
                    success: false,
                    executed: true,
                    steps: [
                        `There was an error removing the AI index from \`${branch}\`.`,
                    ],
                    errors: [
                        JSON.stringify(error, null, 2),
                    ],
                })
            )
        }
        return result;
    }
}