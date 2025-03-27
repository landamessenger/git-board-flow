import { Execution } from "../../model/execution";
import { Result } from "../../model/result";
import { IssueRepository } from "../../repository/issue_repository";
import { ProjectRepository } from "../../repository/project_repository";
import { logDebugInfo, logError, logInfo } from "../../utils/logger";
import { ParamUseCase } from "../base/param_usecase";

export class LinkIssueProjectUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'LinkIssueProjectUseCase';
    private issueRepository = new IssueRepository();
    private projectRepository = new ProjectRepository();

    async invoke(param: Execution): Promise<Result[]> {
        logInfo(`Executing ${this.taskId}.`)

        const result: Result[] = []

        try {
            const projects = await this.issueRepository.fetchIssueProjects(
                param.owner,
                param.repo,
                param.issue.number,
                param.tokens.tokenPat,
            )

            logDebugInfo(`Projects linked to issue #${param.issue.number}: ${JSON.stringify(projects)}`);

            for (const project of param.projects) {
                if (projects.map((value) => value.project.url).indexOf(project.url) > -1) {
                    continue;
                }

                let currentProject = await this.projectRepository.getProjectDetail(
                    project.url,
                    param.tokens.tokenPat,
                )

                if (currentProject === undefined) {
                    result.push(
                        new Result({
                            id: this.taskId,
                            success: false,
                            executed: true,
                            steps: [
                                `Tried to link the issue to [\`${project.url}\`](${project.url}) but there was a problem.`,
                            ]
                        })
                    )
                    continue;
                }

                const issueId = await this.issueRepository.getId(
                    param.owner,
                    param.repo,
                    param.issue.number,
                    param.tokens.token,
                )

                const actionDone = await this.projectRepository.linkContentId(project, issueId, param.tokens.tokenPat)
                if (actionDone) {
                    result.push(
                        new Result({
                            id: this.taskId,
                            success: true,
                            executed: true,
                            steps: [
                                `The issue was linked to [**${currentProject?.title}**](${currentProject?.url}).`,
                            ]
                        })
                    )
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