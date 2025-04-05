import { Execution } from "../../../data/model/execution";
import { Result } from "../../../data/model/result";
import { BranchRepository } from "../../../data/repository/branch_repository";
import { IssueRepository } from "../../../data/repository/issue_repository";
import { ProjectRepository } from "../../../data/repository/project_repository";
import { logDebugInfo, logError, logInfo } from "../../../utils/logger";
import { ParamUseCase } from "../../base/param_usecase";

export class CheckChangesPullRequestSizeUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'CheckChangesPullRequestSizeUseCase';
    
    private branchRepository = new BranchRepository();
    private issueRepository = new IssueRepository();
    private projectRepository = new ProjectRepository();

    async invoke(param: Execution): Promise<Result[]> {
        logInfo(`Executing ${this.taskId}.`)

        const result: Result[] = []
        try {
            const { size, githubSize, reason } = await this.branchRepository.getSizeCategoryAndReason(
                param.owner,
                param.repo,
                param.pullRequest.head,
                param.pullRequest.base,
                param.sizeThresholds,
                param.labels,
                param.tokens.token,
            )

            logDebugInfo(`Size: ${size}`);
            logDebugInfo(`Github Size: ${githubSize}`);
            logDebugInfo(`Reason: ${reason}`);
            logDebugInfo(`Labels: ${param.labels.sizedLabelOnPullRequest}`);

            if (param.labels.sizedLabelOnPullRequest !== size) {
                /**
                 * Even if this is for pull reuqets, we are getting the issue labels for having a mirror of the issue labels on the pull request.
                 */
                const labelNames = param.labels.currentIssueLabels.filter(name => param.labels.sizeLabels.indexOf(name) === -1);
                labelNames.push(size);

                await this.issueRepository.setLabels(
                    param.owner,
                    param.repo,
                    param.pullRequest.number,
                    labelNames,
                    param.tokens.githubToken,
                )

                for (const project of param.project.getProjects()) {
                    await this.projectRepository.setTaskSize(
                        project,
                        param.owner,
                        param.repo,
                        param.pullRequest.number,
                        githubSize,
                        param.tokens.token,
                    )
                }

                logDebugInfo(`Updated labels on pull request #${param.pullRequest.number}:`);
                logDebugInfo(`Labels: ${labelNames}`);

                result.push(
                    new Result({
                        id: this.taskId,
                        success: true,
                        executed: true,
                        steps: [
                            `${reason}, so the pull request was resized to ${size}.`,
                        ],
                    })
                );
            } else {
                logDebugInfo(`The pull request is already at the correct size.`);
                result.push(
                    new Result({
                        id: this.taskId,
                        success: true,
                        executed: true,
                    })
                );
            }
        } catch (error) {
            logError(error);
            result.push(
                new Result({
                    id: this.taskId,
                    success: false,
                    executed: true,
                    steps: [
                        `Tried to check the size of the changes, but there was a problem.`,
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