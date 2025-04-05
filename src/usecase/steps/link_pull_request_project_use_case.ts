import { Execution } from "../../data/model/execution";
import { Result } from "../../data/model/result";
import { ProjectRepository } from "../../data/repository/project_repository";
import { logError, logInfo } from "../../utils/logger";
import { ParamUseCase } from "../base/param_usecase";

export class LinkPullRequestProjectUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'LinkPullRequestProjectUseCase';
    
    private projectRepository = new ProjectRepository();

    async invoke(param: Execution): Promise<Result[]> {
        logInfo(`Executing ${this.taskId}.`)

        const result: Result[] = []

        try {
            for (const project of param.project.getProjects()) {
                let actionDone = await this.projectRepository.linkContentId(
                    project,
                    param.pullRequest.id,
                    param.tokens.tokenPat
                )

                if (actionDone) {
                    /**
                     * Wait for 10 seconds to ensure the pull request is linked to the project
                     */
                    await new Promise(resolve => setTimeout(resolve, 10000));
                    actionDone = await this.projectRepository.moveIssueToColumn(
                        project,
                        param.owner,
                        param.repo,
                        param.pullRequest.number,
                        param.project.getProjectColumnPullRequestCreated(),
                        param.tokens.tokenPat,
                    )

                    if (actionDone) {
                        result.push(
                            new Result({
                                id: this.taskId,
                                success: true,
                                executed: true,
                                steps: [
                                    `The pull request was linked to [**${project?.title}**](${project?.url}) and moved to the column \`${param.project.getProjectColumnPullRequestCreated()}\`.`,
                                ],
                            })
                        )
                    } else {
                        result.push(
                            new Result({
                                id: this.taskId,
                                success: false,
                                executed: true,
                                steps: [
                                    `The pull request was linked to [**${project?.title}**](${project?.url}) but there was an error moving it to the column \`${param.project.getProjectColumnPullRequestCreated()}\`.`,
                                ],
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
                        `Tried to link pull request to project, but there was a problem.`,
                    ],
                    error: error,
                })
            )
        }
        return result;
    }
}