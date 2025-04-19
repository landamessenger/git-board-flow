"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IssueContentInterface = void 0;
const issue_repository_1 = require("../../../data/repository/issue_repository");
const logger_1 = require("../../../utils/logger");
const content_interface_1 = require("./content_interface");
class IssueContentInterface extends content_interface_1.ContentInterface {
    constructor() {
        super(...arguments);
        this.issueRepository = new issue_repository_1.IssueRepository();
        this.internalGetter = async (execution) => {
            try {
                let number = -1;
                if (execution.isSingleAction) {
                    if (execution.isIssue) {
                        number = execution.issue.number;
                    }
                    else if (execution.isPullRequest) {
                        number = execution.pullRequest.number;
                    }
                    else if (execution.isPush) {
                        number = execution.issueNumber;
                    }
                    else {
                        number = execution.singleAction.currentSingleActionIssue;
                    }
                }
                else if (execution.isIssue) {
                    number = execution.issue.number;
                }
                else if (execution.isPullRequest) {
                    number = execution.pullRequest.number;
                }
                else if (execution.isPush) {
                    number = execution.issueNumber;
                }
                else {
                    return undefined;
                }
                const description = await this.issueRepository.getDescription(execution.owner, execution.repo, number, execution.tokens.token);
                return this.getContent(description);
            }
            catch (error) {
                (0, logger_1.logError)(`Error reading issue configuration: ${error}`);
                throw error;
            }
        };
        this.internalUpdate = async (execution, content) => {
            try {
                let number = -1;
                if (execution.isSingleAction) {
                    if (execution.isIssue) {
                        number = execution.issue.number;
                    }
                    else if (execution.isPullRequest) {
                        number = execution.pullRequest.number;
                    }
                    else if (execution.isPush) {
                        number = execution.issueNumber;
                    }
                    else {
                        number = execution.singleAction.currentSingleActionIssue;
                    }
                }
                else if (execution.isIssue) {
                    number = execution.issue.number;
                }
                else if (execution.isPullRequest) {
                    number = execution.pullRequest.number;
                }
                else if (execution.isPush) {
                    number = execution.issueNumber;
                }
                else {
                    return undefined;
                }
                const description = await this.issueRepository.getDescription(execution.owner, execution.repo, number, execution.tokens.token);
                const updated = this.updateContent(description, content);
                if (updated === undefined) {
                    return undefined;
                }
                await this.issueRepository.updateDescription(execution.owner, execution.repo, number, updated, execution.tokens.token);
                return updated;
            }
            catch (error) {
                (0, logger_1.logError)(`Error reading issue configuration: ${error}`);
                throw error;
            }
        };
    }
}
exports.IssueContentInterface = IssueContentInterface;
