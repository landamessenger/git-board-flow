import {ParamUseCase} from "../base/param_usecase";
import {Execution} from "../../model/execution";
import {ProjectRepository} from "../../repository/project_repository";
import {error} from "@actions/core";
import {Result} from "../../model/result";

export class LinkPullRequestProjectUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'LinkPullRequestProjectUseCase';
    private projectRepository = new ProjectRepository();

    async invoke(param: Execution): Promise<Result[]> {
        const result: Result[] = []

        try {
            for (const project of param.projects) {
                await this.projectRepository.linkContentId(project, param.pullRequest.id, param.tokens.tokenPat)
                result.push(
                    new Result({
                        id: this.taskId,
                        success: true,
                        executed: true,
                        steps: [
                            `The pull request was linked to \`${project.url}\`.`,
                        ],
                        error: error,
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
                        `Tried to link pull request to project, but there was a problem.`,
                    ],
                    error: error,
                })
            )
        }
        return result;
    }
}