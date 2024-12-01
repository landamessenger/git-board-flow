import {ParamUseCase} from "../base/param_usecase";
import {Execution} from "../../model/execution";
import {IssueRepository} from "../../repository/issue_repository";
import {Result} from "../../model/result";
import * as core from '@actions/core';

export class CloseIssueUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'CloseIssueUseCase';
    private issueRepository = new IssueRepository();

    async invoke(param: Execution): Promise<Result[]> {
        core.info(`Executing ${this.taskId}.`)

        const result: Result[] = []
        try {
            const closed = await this.issueRepository.closeIssue(
                param.owner,
                param.repo,
                param.number,
                param.tokens.token,
            );
            if (closed) {
                await this.issueRepository.addComment(
                    param.owner,
                    param.repo,
                    param.number,
                    `This issue was closed after merging #${param.pullRequest.number}.`,
                    param.tokens.token,
                )
                result.push(
                    new Result({
                        id: this.taskId,
                        success: true,
                        executed: true,
                        steps: [
                            `#${param.number} was automatically closed after merging this pull request.`
                        ]
                    })
                )
            } else {
                result.push(
                    new Result({
                        id: this.taskId,
                        success: true,
                        executed: false,
                    })
                )
            }

        } catch (error) {
            result.push(
                new Result({
                    id: this.taskId,
                    success: false,
                    executed: true,
                    steps: [
                        `Tried to close issue #${param.number}, but there was a problem.`,
                    ],
                    error: error,
                })
            )
        }
        return result
    }
}