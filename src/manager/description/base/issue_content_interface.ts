import { Execution } from "../../../data/model/execution";
import { IssueRepository } from "../../../data/repository/issue_repository";
import { logError } from "../../../utils/logger";
import { ContentInterface } from "./content_interface";

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
            } else if (execution.isPush) {
                number = execution.issueNumber
            } else {
                return undefined;
            }

            const description = await this.issueRepository.getDescription(
                execution.owner,
                execution.repo,
                number,
                execution.tokens.githubToken,
            )

            return this.getContent(description)
        } catch (error) {
            logError(`Error reading issue configuration: ${error}`);
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
            } else if (execution.isPush) {
                number = execution.issueNumber;
            } else {
                return undefined;
            }

            const description = await this.issueRepository.getDescription(
                execution.owner,
                execution.repo,
                number,
                execution.tokens.githubToken,
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
                execution.tokens.githubToken,
            )

            return updated
        } catch (error) {
            logError(`Error reading issue configuration: ${error}`);
            throw error;
        }
    }
}
