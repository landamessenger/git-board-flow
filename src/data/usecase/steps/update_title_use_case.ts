import {ParamUseCase} from "../base/param_usecase";
import {Execution} from "../../model/execution";
import {IssueRepository} from "../../repository/issue_repository";
import {Result} from "../../model/result";


export class UpdateTitleUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'UpdateTitleUseCase';
    private issueRepository = new IssueRepository();

    async invoke(param: Execution): Promise<Result[]> {
        const result: Result[] = []
        try {
            if (param.emojiLabeledTitle) {
                const title = await this.issueRepository.updateTitle(
                    param.owner,
                    param.repo,
                    param.issue.title,
                    param.issue.number,
                    param.branchType,
                    param.hotfix.active,
                    param.labels.isQuestion,
                    param.labels.isHelp,
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
                            success: false,
                            executed: true,
                            steps: [
                                `Tried to update the issue's title \`${param.issue.title}\` but there was a problem.`,
                            ]
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
        } catch (error) {
            result.push(
                new Result({
                    id: this.taskId,
                    success: false,
                    executed: true,
                    steps: [
                        `Tried to update issue's title, but there was a problem.`,
                    ],
                    error: error,
                })
            )
        }
        return result
    }
}