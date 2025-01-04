import {ParamUseCase} from "../base/param_usecase";
import {Execution} from "../../model/execution";
import {ProjectRepository} from "../../repository/project_repository";
import * as core from "@actions/core";
import {Result} from "../../model/result";
import {MarkdownContentHotfixHandler} from "../../manager/description/markdown_content_hotfix_handler";
import {IssueRepository} from "../../repository/issue_repository";
import {extractVersion} from "../../utils/content_utils";

export class GetHotfixVersionUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'GetHotfixVersionUseCase';
    private issueRepository = new IssueRepository();

    async invoke(param: Execution): Promise<Result[]> {
        core.info(`Executing ${this.taskId}.`);

        const result: Result[] = [];

        try {
            let number = -1
            if (param.isIssue) {
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

            const baseVersion = extractVersion('Base Version', description)
            const hotfixVersion = extractVersion('Hotfix Version', description)

            if (baseVersion === undefined) {
                result.push(
                    new Result({
                        id: this.taskId,
                        success: false,
                        executed: true,
                        steps: [`Tried to get the base version but there was a problem identifying the version.`],
                    })
                );
                return result;
            } else if (hotfixVersion === undefined) {
                result.push(
                    new Result({
                        id: this.taskId,
                        success: false,
                        executed: true,
                        steps: [`Tried to get the hotfix version but there was a problem identifying the version.`],
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
                        baseVersion: baseVersion,
                        hotfixVersion: hotfixVersion,
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
