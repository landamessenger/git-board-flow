import { Execution } from "../../model/execution";
import { Result } from "../../model/result";
import { BranchRepository } from "../../repository/branch_repository";
import { IssueRepository } from "../../repository/issue_repository";
import { ProjectRepository } from "../../repository/project_repository";
import { logDebugInfo, logError, logInfo } from "../../utils/logger";
import { ParamUseCase } from "../base/param_usecase";

export class CheckChangesIssueSizeUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'CheckChangesIssueSizeUseCase';
    private branchRepository = new BranchRepository();
    private issueRepository = new IssueRepository();
    private projectRepository = new ProjectRepository();

    async invoke(param: Execution): Promise<Result[]> {
        logInfo(`Executing ${this.taskId}.`)

        const result: Result[] = []
        try {
            if (param.currentConfiguration.parentBranch === undefined) {
                logDebugInfo(`Parent branch is undefined.`)
                return result;
            }

            const headBranch = param.commit.branch;
            const baseBranch = param.currentConfiguration.parentBranch;

            const { size, githubSize, reason } = await this.branchRepository.getSizeCategoryAndReason(
                param.owner,
                param.repo,
                headBranch,
                baseBranch,
                param.sizeThresholds,
                param.labels,
                param.tokens.tokenPat,
            )

            logDebugInfo(`Size: ${size}`);
            logDebugInfo(`Github Size: ${githubSize}`);
            logDebugInfo(`Reason: ${reason}`);
            logDebugInfo(`Labels: ${param.labels.sizedLabelOnIssue}`);

            if (param.labels.sizedLabelOnIssue !== size) {
                const labelNames = param.labels.currentIssueLabels.filter(name => param.labels.sizeLabels.indexOf(name) === -1);
                labelNames.push(size);

                await this.issueRepository.setLabels(
                    param.owner,
                    param.repo,
                    param.issueNumber,
                    labelNames,
                    param.tokens.token,
                )

                for (const project of param.project.getProjects()) {
                    await this.projectRepository.setTaskSize(
                        project,
                        param.owner,
                        param.repo,
                        param.issueNumber,
                        githubSize,
                        param.tokens.tokenPat,
                    )
                }

                logDebugInfo(`Updated labels on issue #${param.issueNumber}:`);
                logDebugInfo(`Labels: ${labelNames}`);

                result.push(
                    new Result({
                        id: this.taskId,
                        success: true,
                        executed: true,
                        steps: [
                            `${reason}, so the issue was resized to ${size}.`,
                        ],
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