import { Execution } from "../../model/execution";
import { Result } from "../../model/result";
import { ProjectRepository } from "../../repository/project_repository";
import { logDebugInfo, logError, logInfo } from "../../utils/logger";
import { ParamUseCase } from "../base/param_usecase";

export class CheckPriorityPullRequestSizeUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'CheckPriorityPullRequestSizeUseCase';

    private projectRepository = new ProjectRepository();

    async invoke(param: Execution): Promise<Result[]> {
        logInfo(`Executing ${this.taskId}.`)

        const result: Result[] = []
        try {
            const priority = param.labels.priorityLabelOnIssue;

            if (!param.labels.priorityLabelOnIssueProcessable || param.project.getProjects().length === 0) {
                result.push(
                    new Result({
                        id: this.taskId,
                        success: true,
                        executed: false,
                    })
                );
                return result;
            }

            let priorityLabel = ``;

            if (priority === param.labels.priorityHigh) {
                priorityLabel = `P0`;
            } else if (priority === param.labels.priorityMedium) {
                priorityLabel = `P1`;
            } else if (priority === param.labels.priorityLow) {
                priorityLabel = `P2`;
            } else {
                result.push(
                    new Result({
                        id: this.taskId,
                        success: true,
                        executed: false,
                    })
                );
                return result;
            }

            logDebugInfo(`Priority: ${priority}`);
            logDebugInfo(`Github Priority Label: ${priorityLabel}`);

            for (const project of param.project.getProjects()) {
                await this.projectRepository.setTaskPriority(
                    project,
                    param.owner,
                    param.repo,
                    param.pullRequest.number,
                    priorityLabel,
                    param.tokens.tokenPat,
                );
            }

            result.push(
                new Result({
                    id: this.taskId,
                    success: true,
                    executed: true,
                    steps: [
                        `Priority pull request size checked and set to \`${priorityLabel}\`.`,
                    ],
                })
            );
        } catch (error) {
            logError(error);
            result.push(
                new Result({
                    id: this.taskId,
                    success: false,
                    executed: true,
                    steps: [
                        `Tried to check the priority of the issue, but there was a problem.`,
                    ],
                    errors: [
                        error?.toString() ?? 'Unknown error',
                    ],
                })
            )
        }
        return result
    }
}
