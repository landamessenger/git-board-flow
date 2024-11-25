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
            const projects = await this.issueRepository.fetchIssueProjects(
                param.owner,
                param.repo,
                param.issue.number,
                param.tokens.tokenPat,
            )
            core.info(`Projects linked to issue #${param.issue.number}: ${JSON.stringify(projects)}`);

            for (const project of param.projects) {
                if (projects.map((value) => value.project.url).indexOf(project.url) > -1) {
                    continue;
                }

                let currentProject: ProjectItem | undefined;
                for (const p of projects) {
                    if (p.project.url === project.url) {
                        currentProject = p;
                        break;
                    }
                }

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

                await this.projectRepository.linkContentId(project, issueId, param.tokens.tokenPat)

                result.push(
                    new Result({
                        id: this.taskId,
                        success: true,
                        executed: true,
                        steps: [
                            `The issue was linked to [**${currentProject?.project.title}**](${currentProject?.project.url}).`,
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
                        `Tried to link issue to project, but there was a problem.`,
                    ],
                    error: error,
                })
            )
        }
        return result;
    }
}