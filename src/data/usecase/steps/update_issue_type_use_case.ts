import { Execution } from "../../model/execution";
import { Result } from "../../model/result";
import { IssueRepository } from "../../repository/issue_repository";
import { logError, logInfo } from "../../utils/logger";
import { ParamUseCase } from "../base/param_usecase";

export class UpdateIssueTypeUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'UpdateIssueTypeUseCase';
    private issueRepository = new IssueRepository();

    async invoke(param: Execution): Promise<Result[]> {
        logInfo(`Executing ${this.taskId}.`)

        const result: Result[] = []

        try {
            await this.issueRepository.setIssueType(
                param.owner,
                param.repo,
                param.issueNumber,
                param.labels,
                param.tokens.token,
            );
        } catch (error) {
            logError(error);
            result.push(
                new Result({
                    id: this.taskId,
                    success: false,
                    executed: true,
                    steps: [
                        `Tried to update issue type, but there was a problem.`,
                    ],
                    error: error,
                })
            )
        }
        return result;
    }
}