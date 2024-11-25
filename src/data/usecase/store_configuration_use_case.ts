import {IssueRepository} from "../repository/issue_repository";
import {ParamUseCase} from "./base/param_usecase";
import {Execution} from "../model/execution";
import {PullRequestRepository} from "../repository/pull_request_repository";

/**
 * Store las configuration in the description
 */
export class StoreConfigurationUseCase implements ParamUseCase<Execution, void> {
    taskId: string = 'StoreConfigurationUseCase';
    private issueRepository = new IssueRepository();
    private pullRequestRepository = new PullRequestRepository();

    async invoke(param: Execution): Promise<void> {
        try {
            if (param.issueAction) {
                await this.issueRepository.updateConfig(
                    param.owner,
                    param.repo,
                    param.issue.number,
                    param.currentConfiguration,
                    param.tokens.token,
                )
            } else if (param.pullRequestAction) {
                await this.pullRequestRepository.updateConfig(
                    param.owner,
                    param.repo,
                    param.pullRequest.number,
                    param.currentConfiguration,
                    param.tokens.token,
                )
            }
        } catch (error) {
            console.error(error);
        }
    }
}
