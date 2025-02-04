import {ParamUseCase} from "../base/param_usecase";
import {Execution} from "../../model/execution";
import * as core from "@actions/core";
import {Result} from "../../model/result";
import {IssueRepository} from "../../repository/issue_repository";
import {extractVersion} from "../../utils/content_utils";

export class GetReleaseVersionUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'GetReleaseVersionUseCase';
    private issueRepository = new IssueRepository();

    async invoke(param: Execution): Promise<Result[]> {
        core.info(`Executing ${this.taskId}.`);

        const result: Result[] = [];

        try {
            let number = -1
            if (param.isSingleAction) {
                number = param.singleAction.currentSingleActionIssue
            } else if (param.isIssue) {
                number = param.issue.number
            } else if (param.isPullRequest) {
                number = param.pullRequest.number
            } else {
                result.push(
                    new Result({
                        id: this.taskId,
                        success: false,
                        executed: true,
                        steps: [`Tried to get the version but there was a problem identifying the issue.`],
                    })
                );
                return result;
            }

            const description = await this.issueRepository.getDescription(
                param.owner,
                param.repo,
                number,
                param.tokens.token,
            )

            if (description === undefined) {
                result.push(
                    new Result({
                        id: this.taskId,
                        success: false,
                        executed: true,
                        steps: [`Tried to get the version but there was a problem getting the description.`],
                    })
                );
                return result;
            }

            const releaseVersion = extractVersion('Release Version', description)

            if (releaseVersion === undefined) {
                result.push(
                    new Result({
                        id: this.taskId,
                        success: false,
                        executed: true,
                    })
                );
                return result;
            }

            result.push(
                new Result({
                    id: this.taskId,
                    success: true,
                    executed: true,
                    payload: {
                        releaseVersion: releaseVersion,
                    }
                })
            );
        } catch (error) {
            console.error(error);
            result.push(
                new Result({
                    id: this.taskId,
                    success: false,
                    executed: true,
                    steps: [`Tried to check action permissions.`],
                    error: error,
                })
            );
        }

        return result;
    }
}
