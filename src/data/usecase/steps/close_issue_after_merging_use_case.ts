import { Execution } from "../../model/execution";
import { Result } from "../../model/result";
import { IssueRepository } from "../../repository/issue_repository";
import { logInfo } from "../../utils/logger";
import { ParamUseCase } from "../base/param_usecase";

export class CloseIssueAfterMergingUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'CloseIssueAfterMergingUseCase';
    private issueRepository = new IssueRepository();

    async invoke(param: Execution): Promise<Result[]> {
        logInfo(`Executing ${this.taskId}.`)

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
}