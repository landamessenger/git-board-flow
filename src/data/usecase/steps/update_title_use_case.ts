import {ParamUseCase} from "../base/param_usecase";
import {Execution} from "../../model/execution";
import {IssueRepository} from "../../repository/issue_repository";
import {Result} from "../../model/result";
import * as core from '@actions/core';
import {issue} from "@actions/core/lib/command";

export class UpdateTitleUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'UpdateTitleUseCase';
    private issueRepository = new IssueRepository();

    async invoke(param: Execution): Promise<Result[]> {
        core.info(`Executing ${this.taskId}.`)

        const result: Result[] = []
        try {
            if (param.isIssue) {
                if (param.emoji.emojiLabeledTitle) {
                    const title = await this.issueRepository.updateTitleIssueFormat(
                        param.owner,
                        param.repo,
                        param.issue.title,
                        param.issue.number,
                        param.issue.branchManagementAlways,
                        param.emoji.branchManagementEmoji,
                        param.labels,
                        param.tokens.token,
                    );
                    if (title) {
                        result.push(
                            new Result({
                                id: this.taskId,
                                success: true,
                                executed: true,
                                steps: [
                                    `The issue's title was updated from \`${param.issue.title}\` to \`${title}\`.`,
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
                } else {
                    result.push(
                        new Result({
                            id: this.taskId,
                            success: true,
                            executed: false,
                        })
                    )
                }
            } else if (param.isPullRequest) {
                if (param.emoji.emojiLabeledTitle) {
                    const issueTitle = await this.issueRepository.getTitle(
                        param.owner,
                        param.repo,
                        param.issueNumber,
                        param.tokens.tokenPat,
                    )
                    if (issueTitle === undefined) {
                        result.push(
                            new Result({
                                id: this.taskId,
                                success: false,
                                executed: true,
                                steps: [
                                    `Tried to update title, but there was a problem.`,
                                ],
                            })
                        )
                        return result
                    }
                    const title = await this.issueRepository.updateTitlePullRequestFormat(
                        param.owner,
                        param.repo,
                        issueTitle,
                        param.issueNumber,
                        param.pullRequest.number,
                        false,
                        '',
                        param.labels,
                        param.tokens.token,
                    );
                    if (title) {
                        result.push(
                            new Result({
                                id: this.taskId,
                                success: true,
                                executed: true,
                                steps: [
                                    `The pull request's title was updated from \`${param.pullRequest.title}\` to \`${title}\`.`,
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
                } else {
                    result.push(
                        new Result({
                            id: this.taskId,
                            success: true,
                            executed: false,
                        })
                    )
                }
            }
        } catch (error) {
            result.push(
                new Result({
                    id: this.taskId,
                    success: false,
                    executed: true,
                    steps: [
                        `Tried to update title, but there was a problem.`,
                    ],
                    error: error,
                })
            )
        }
        return result
    }
}