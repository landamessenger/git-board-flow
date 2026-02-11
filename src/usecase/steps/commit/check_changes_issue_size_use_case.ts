import { Execution } from "../../../data/model/execution";
import { Result } from "../../../data/model/result";
import { BranchRepository } from "../../../data/repository/branch_repository";
import { IssueRepository } from "../../../data/repository/issue_repository";
import { ProjectRepository } from "../../../data/repository/project_repository";
import { PullRequestRepository } from "../../../data/repository/pull_request_repository";
import { logDebugInfo, logError, logInfo } from "../../../utils/logger";
import { getTaskEmoji } from "../../../utils/task_emoji";
import { ParamUseCase } from "../../base/param_usecase";

export class CheckChangesIssueSizeUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'CheckChangesIssueSizeUseCase';

    private branchRepository = new BranchRepository();
    private issueRepository = new IssueRepository();
    private projectRepository = new ProjectRepository();
    private pullRequestRepository = new PullRequestRepository();

    async invoke(param: Execution): Promise<Result[]> {
        logInfo(`${getTaskEmoji(this.taskId)} Executing ${this.taskId}.`);

        const result: Result[] = [];
        try {
            const baseBranch =
                param.currentConfiguration.parentBranch ??
                param.branches.development ??
                'develop';
            if (!baseBranch) {
                logDebugInfo(`Parent branch could not be determined.`);
                return result;
            }

            const headBranch = param.commit.branch;

            const { size, githubSize, reason } = await this.branchRepository.getSizeCategoryAndReason(
                param.owner,
                param.repo,
                headBranch,
                baseBranch,
                param.sizeThresholds,
                param.labels,
                param.tokens.token,
            );

            logDebugInfo(`Size: ${size}`);
            logDebugInfo(`Github Size: ${githubSize}`);
            logDebugInfo(`Reason: ${reason}`);
            logDebugInfo(`Labels: ${param.labels.sizedLabelOnIssue}`);

            if (param.labels.sizedLabelOnIssue !== size) {
                const labelNames = param.labels.currentIssueLabels.filter(
                    (name) => param.labels.sizeLabels.indexOf(name) === -1
                );
                labelNames.push(size);

                await this.issueRepository.setLabels(
                    param.owner,
                    param.repo,
                    param.issueNumber,
                    labelNames,
                    param.tokens.token,
                );

                for (const project of param.project.getProjects()) {
                    await this.projectRepository.setTaskSize(
                        project,
                        param.owner,
                        param.repo,
                        param.issueNumber,
                        githubSize,
                        param.tokens.token,
                    );
                }

                const openPrNumbers = await this.pullRequestRepository.getOpenPullRequestNumbersByHeadBranch(
                    param.owner,
                    param.repo,
                    headBranch,
                    param.tokens.token,
                );
                for (const prNumber of openPrNumbers) {
                    const prLabels = await this.issueRepository.getLabels(
                        param.owner,
                        param.repo,
                        prNumber,
                        param.tokens.token,
                    );
                    const prLabelNames = prLabels.filter((name) => param.labels.sizeLabels.indexOf(name) === -1);
                    prLabelNames.push(size);
                    await this.issueRepository.setLabels(
                        param.owner,
                        param.repo,
                        prNumber,
                        prLabelNames,
                        param.tokens.token,
                    );
                    for (const project of param.project.getProjects()) {
                        await this.projectRepository.setTaskSize(
                            project,
                            param.owner,
                            param.repo,
                            prNumber,
                            githubSize,
                            param.tokens.token,
                        );
                    }
                    logDebugInfo(`Updated size label on PR #${prNumber} to ${size}.`);
                }

                logDebugInfo(`Updated labels on issue #${param.issueNumber}:`);
                logDebugInfo(`Labels: ${labelNames}`);

                result.push(
                    new Result({
                        id: this.taskId,
                        success: true,
                        executed: true,
                        steps: [
                            `${reason}, so the issue was resized to ${size}.` +
                                (openPrNumbers.length > 0 ? ` Same label applied to ${openPrNumbers.length} open PR(s).` : ''),
                        ],
                    }),
                );
            } else {
                logDebugInfo(`The issue is already at the correct size.`);
                result.push(
                    new Result({
                        id: this.taskId,
                        success: true,
                        executed: true,
                    }),
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
                    errors: [error?.toString() ?? 'Unknown error'],
                }),
            );
        }
        return result;
    }
}