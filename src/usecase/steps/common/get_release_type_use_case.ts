import { Execution } from "../../../data/model/execution";
import { Result } from "../../../data/model/result";
import { IssueRepository } from "../../../data/repository/issue_repository";
import { extractReleaseType } from "../../../utils/content_utils";
import { logError, logInfo } from "../../../utils/logger";
import { ParamUseCase } from "../../base/param_usecase";

export class GetReleaseTypeUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'GetReleaseTypeUseCase';
    
    private issueRepository = new IssueRepository();

    async invoke(param: Execution): Promise<Result[]> {
        logInfo(`Executing ${this.taskId}.`);

        const result: Result[] = [];

        try {
            let number = -1
            if (param.isSingleAction) {
                number = param.singleAction.issue;
            } else if (param.isIssue) {
                number = param.issue.number;
            } else if (param.isPullRequest) {
                number = param.pullRequest.number;
            } else {
                result.push(
                    new Result({
                        id: this.taskId,
                        success: false,
                        executed: true,
                        steps: [`Tried to get the release type but there was a problem identifying the issue.`],
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
                        steps: [`Tried to get the release type but there was a problem getting the description.`],
                    })
                );
                return result;
            }

            const releaseType = extractReleaseType('Release Type', description)

            if (releaseType === undefined) {
                result.push(
                    new Result({
                        id: this.taskId,
                        success: false,
                        executed: true,
                        steps: [`Tried to get the release type but there was a problem identifying the type.`],
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
                        releaseType: releaseType,
                    }
                })
            );
        } catch (error) {
            logError(error);
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
