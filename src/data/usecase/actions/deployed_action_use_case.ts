import {ParamUseCase} from "../base/param_usecase";
import {Execution} from "../../model/execution";
import {IssueRepository} from "../../repository/issue_repository";
import * as core from "@actions/core";
import {Result} from "../../model/result";

export class DeployedActionUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'DeployedActionUseCase';
    private issueRepository = new IssueRepository();

    async invoke(param: Execution): Promise<Result[]> {
        core.info(`Executing ${this.taskId}.`);

        const result: Result[] = [];

        try {
            const issueNumber = parseInt('${{ github.event.inputs.issue }}'.replace('#', ''), 10);

            const labels = await this.issueRepository.getLabels(
                param.owner,
                param.repo,
                issueNumber,
                param.tokens.token,
            )

            if (labels.indexOf(param.labels.deploy) === -1) {
                result.push(
                    new Result({
                        id: this.taskId,
                        success: false,
                        executed: true,
                        steps: [
                            `Tried to set label \`${param.labels.deployed}\` but there was no \`${param.labels.deploy}\` label`,
                        ],
                    })
                );
                return result;
            }

            const labelNames = labels.filter(name => name !== param.labels.deploy);
            labelNames.push(param.labels.deployed);

            await this.issueRepository.setLabels(
                param.owner,
                param.repo,
                issueNumber,
                labelNames,
                param.tokens.token,
            )

            console.log(`Updated labels on issue #${issueNumber}:`, labelNames);

            result.push(
                new Result({
                    id: this.taskId,
                    success: true,
                    executed: true,
                    steps: [
                        `Label \`${param.labels.deployed}\` added after a success deploy.`,
                    ],
                })
            );

            return result;
        } catch (error) {
            console.error(error);
            result.push(
                new Result({
                    id: this.taskId,
                    success: false,
                    executed: true,
                    steps: [`Tried to assign members to issue.`],
                    error: error,
                })
            );
        }

        return result;
    }
}
