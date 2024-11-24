import {ParamUseCase} from "../base/param_usecase";
import {Execution} from "../../model/execution";
import {IssueRepository} from "../../repository/issue_repository";
import {ProjectRepository} from "../../repository/project_repository";
import * as core from "@actions/core";
import {Result} from "../../model/result";

export class LinkIssueProjectUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'LinkIssueProjectUseCase';
    private issueRepository = new IssueRepository();
    private projectRepository = new ProjectRepository();

    async invoke(param: Execution): Promise<Result[]> {
        const result: Result[] = []

        try {
            const projects = this.issueRepository.fetchIssueProjects(
                param.owner,
                param.repo,
                param.issue.number,
                param.tokens.token,
            )
            core.info(`Projects linked to issue #${param.issue.number}: ${JSON.stringify(projects)}`);

            for (const project of param.projects) {
                const issueId = await this.issueRepository.getId(
                    param.owner,
                    param.repo,
                    param.issue.number,
                    param.tokens.token,
                )

                await this.projectRepository.linkContentId(project, issueId, param.tokens.tokenPat)

                result.push(
                    new Result({
                        id: this.taskId,
                        success: true,
                        executed: true,
                        steps: [
                            `The issue was linked to \`${project.url}\``,
                        ]
                    })
                )
            }

            return result;
        } catch (error) {
            console.error(error);
            result.push(
                new Result({
                    id: this.taskId,
                    success: false,
                    executed: true,
                    steps: [
                        `Tried to prepare the hotfix to the issue, but there was a problem.`,
                    ],
                    error: error,
                })
            )
        }
        return result;
    }
}