import * as core from "@actions/core";
import {ContentInterface} from "./content_interface";
import {IssueRepository} from "../../../repository/issue_repository";
import {Execution} from "../../../model/execution";

export abstract class IssueContentInterface extends ContentInterface {
    private issueRepository = new IssueRepository();

    internalGetter = async (execution: Execution): Promise<string | undefined> => {
        try {
            let number = -1
            if (execution.isSingleAction) {
                number = execution.singleAction.currentSingleActionIssue
            } else if (execution.isIssue) {
                number = execution.issue.number
            } else if (execution.isPullRequest) {
                number = execution.pullRequest.number
            } else {
                return undefined;
            }

            const description = await this.issueRepository.getDescription(
                execution.owner,
                execution.repo,
                number,
                execution.tokens.token,
            )

            return this.getContent(description)
        } catch (error) {
            core.error(`Error reading issue configuration: ${error}`);
            throw error;
        }
    }

    internalUpdate = async (execution: Execution, content: string): Promise<string | undefined> => {
        try {
            let number = -1
            if (execution.isSingleAction) {
                number = execution.singleAction.currentSingleActionIssue;
            } else if (execution.isIssue) {
                number = execution.issue.number;
            } else if (execution.isPullRequest) {
                number = execution.pullRequest.number;
            } else {
                return undefined;
            }

            const description = await this.issueRepository.getDescription(
                execution.owner,
                execution.repo,
                number,
                execution.tokens.token,
            )

            const updated = this.updateContent(description, content)
            if (updated === undefined) {
                return undefined
            }

            await this.issueRepository.updateDescription(
                execution.owner,
                execution.repo,
                number,
                updated,
                execution.tokens.token,
            )

            return updated
        } catch (error) {
            core.error(`Error reading issue configuration: ${error}`);
            throw error;
        }
    }
}
