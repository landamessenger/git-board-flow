import { Execution } from "../../../data/model/execution";
import { Result } from "../../../data/model/result";
import { IssueRepository } from "../../../data/repository/issue_repository";
import { ProjectRepository } from "../../../data/repository/project_repository";
import { logError, logInfo } from "../../../utils/logger";
import { ParamUseCase } from "../../base/param_usecase";

export class LinkIssueProjectUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'LinkIssueProjectUseCase';
    
    private issueRepository = new IssueRepository();
    private projectRepository = new ProjectRepository();

    async invoke(param: Execution): Promise<Result[]> {
        logInfo(`Executing ${this.taskId}.`)

        const result: Result[] = []

        try {
            for (const project of param.project.getProjects()) {
                const issueId = await this.issueRepository.getId(
                    param.owner,
                    param.repo,
                    param.issue.number,
                    param.tokens.githubToken,
                )

                let actionDone = await this.projectRepository.linkContentId(project, issueId, param.tokens.token)
                if (actionDone) {
                    /**
                     * Wait for 10 seconds to ensure the issue is linked to the project
                     */
                    await new Promise(resolve => setTimeout(resolve, 10000));
                    actionDone = await this.projectRepository.moveIssueToColumn(
                        project,
                        param.owner,
                        param.repo,
                        param.issue.number,
                        param.project.getProjectColumnIssueCreated(),
                        param.tokens.token,
                    )

                    if (actionDone) {
                        result.push(
                            new Result({
                                id: this.taskId,
                                success: true,
                                executed: true,
                                steps: [
                                    `The issue was linked to [**${project?.title}**](${project?.url}) and moved to the column \`${param.project.getProjectColumnIssueCreated()}\`.`,
                                ]
                            })
                        )
                    } else {
                        result.push(
                            new Result({
                                id: this.taskId,
                                success: false,
                                executed: true,
                                steps: [
                                    `The issue was linked to [**${project?.title}**](${project?.url}) but there was an error moving it to the column \`${param.project.getProjectColumnIssueCreated()}\`.`,
                                ]
                            })
                        )
                    }
                }
            }

            return result;
        } catch (error) {
            logError(error);
            result.push(
                new Result({
                    id: this.taskId,
                    success: false,
                    executed: true,
                    steps: [
                        `Tried to link issue to project, but there was a problem.`,
                    ],
                    error: error,
                })
            )
        }
        return result;
    }
}