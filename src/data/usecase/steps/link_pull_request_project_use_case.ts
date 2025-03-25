import {ParamUseCase} from "../base/param_usecase";
import {Execution} from "../../model/execution";
import {ProjectRepository} from "../../repository/project_repository";
import {error} from "@actions/core";
import {Result} from "../../model/result";
import * as core from '@actions/core';
import { logError } from "../../utils/logger";

export class LinkPullRequestProjectUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'LinkPullRequestProjectUseCase';
    private projectRepository = new ProjectRepository();

    async invoke(param: Execution): Promise<Result[]> {
        core.info(`Executing ${this.taskId}.`)

        const result: Result[] = []

        try {
            for (const project of param.projects) {
                const actionDone = await this.projectRepository.linkContentId(
                    project,
                    param.pullRequest.id,
                    param.tokens.tokenPat
                )
                if (actionDone) {

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
                                    `Tried to link the pull request to [\`${project.url}\`](${project.url}) but there was a problem.`,
                                ]
                            })
                        )
                        continue;
                    }

                    result.push(
                        new Result({
                            id: this.taskId,
                            success: true,
                            executed: true,
                            steps: [
                                `The pull request was linked to [**${currentProject?.title}**](${currentProject?.url}).`,
                            ],
                            error: error,
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
                        `Tried to link pull request to project, but there was a problem.`,
                    ],
                    error: error,
                })
            )
        }
        return result;
    }
}