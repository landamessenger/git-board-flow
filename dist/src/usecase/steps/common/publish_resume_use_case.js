"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PublishResultUseCase = void 0;
const result_1 = require("../../../data/model/result");
const issue_repository_1 = require("../../../data/repository/issue_repository");
const list_utils_1 = require("../../../utils/list_utils");
const logger_1 = require("../../../utils/logger");
/**
 * Publish the resume of actions
 */
class PublishResultUseCase {
    constructor() {
        this.taskId = 'PublishResultUseCase';
        this.issueRepository = new issue_repository_1.IssueRepository();
    }
    async invoke(param) {
        (0, logger_1.logInfo)(`Executing ${this.taskId}.`);
        try {
            /**
             * Comment resume of actions
             */
            let title = '🪄 Automatic Actions';
            let content = '';
            let stupidGif = '';
            let image;
            let errors = '';
            let footer = '';
            if (param.isIssue) {
                if (param.issueNotBranched) {
                    title = '🪄 Automatic Actions';
                    image = (0, list_utils_1.getRandomElement)(param.images.issueAutomaticActions);
                }
                else if (param.release.active) {
                    title = '🚀 Release Actions';
                    image = (0, list_utils_1.getRandomElement)(param.images.issueReleaseGifs);
                }
                else if (param.hotfix.active) {
                    title = '🔥🐛 Hotfix Actions';
                    image = (0, list_utils_1.getRandomElement)(param.images.issueHotfixGifs);
                }
                else if (param.isBugfix) {
                    title = '🐛 Bugfix Actions';
                    image = (0, list_utils_1.getRandomElement)(param.images.issueBugfixGifs);
                }
                else if (param.isFeature) {
                    title = '✨ Feature Actions';
                    image = (0, list_utils_1.getRandomElement)(param.images.issueFeatureGifs);
                }
                else if (param.isDocs) {
                    title = '📝 Documentation Actions';
                    image = (0, list_utils_1.getRandomElement)(param.images.issueDocsGifs);
                }
                else if (param.isChore) {
                    title = '🔧 Chore Actions';
                    image = (0, list_utils_1.getRandomElement)(param.images.issueChoreGifs);
                }
            }
            else if (param.isPullRequest) {
                if (param.release.active) {
                    title = '🚀 Release Actions';
                    image = (0, list_utils_1.getRandomElement)(param.images.pullRequestReleaseGifs);
                }
                else if (param.hotfix.active) {
                    title = '🔥🐛 Hotfix Actions';
                    image = (0, list_utils_1.getRandomElement)(param.images.pullRequestHotfixGifs);
                }
                else if (param.isBugfix) {
                    title = '🐛 Bugfix Actions';
                    image = (0, list_utils_1.getRandomElement)(param.images.pullRequestBugfixGifs);
                }
                else if (param.isFeature) {
                    title = '✨ Feature Actions';
                    image = (0, list_utils_1.getRandomElement)(param.images.pullRequestFeatureGifs);
                }
                else if (param.isDocs) {
                    title = '📝 Documentation Actions';
                    image = (0, list_utils_1.getRandomElement)(param.images.pullRequestDocsGifs);
                }
                else if (param.isChore) {
                    title = '🔧 Chore Actions';
                    image = (0, list_utils_1.getRandomElement)(param.images.pullRequestChoreGifs);
                }
                else {
                    title = '🪄 Automatic Actions';
                    image = (0, list_utils_1.getRandomElement)(param.images.pullRequestAutomaticActions);
                }
            }
            if (image) {
                if (param.isIssue && param.images.imagesOnIssue) {
                    stupidGif = `![image](${image})`;
                }
                else if (param.isPullRequest && param.images.imagesOnPullRequest) {
                    stupidGif = `![image](${image})`;
                }
            }
            let indexStep = 0;
            param.currentConfiguration.results.forEach(r => {
                for (const step of r.steps) {
                    content += `${indexStep + 1}. ${step}\n`;
                    indexStep++;
                }
            });
            let indexReminder = 0;
            param.currentConfiguration.results.forEach(r => {
                for (const reminder of r.reminders) {
                    footer += `${indexReminder + 1}. ${reminder}\n`;
                    indexReminder++;
                }
            });
            let indexError = 0;
            param.currentConfiguration.results.forEach(r => {
                for (const error of r.errors) {
                    errors += `${indexError + 1}.
\`\`\`
${error}
\`\`\`
`;
                    indexError++;
                }
            });
            if (footer.length > 0) {
                footer = `
## Reminder

${footer}
`;
            }
            if (errors.length > 0) {
                errors = `
## Errors Found

${errors}

Check your project configuration, if everything is okay consider [opening an issue](https://github.com/landamessenger/git-board-flow/issues/new/choose).
`;
            }
            const commentBody = `# ${title}
${content}
${errors.length > 0 ? errors : ''}

${stupidGif}

${footer}

🚀 Happy coding!
            `;
            if (content.length === 0) {
                return;
            }
            if (param.isSingleAction) {
                await this.issueRepository.addComment(param.owner, param.repo, param.singleAction.currentSingleActionIssue, commentBody, param.tokens.token);
            }
            else if (param.isIssue) {
                await this.issueRepository.addComment(param.owner, param.repo, param.issue.number, commentBody, param.tokens.token);
            }
            else if (param.isPullRequest) {
                await this.issueRepository.addComment(param.owner, param.repo, param.pullRequest.number, commentBody, param.tokens.token);
            }
        }
        catch (error) {
            (0, logger_1.logError)(error);
            param.currentConfiguration.results.push(new result_1.Result({
                id: this.taskId,
                success: false,
                executed: true,
                steps: [
                    `Tried to publish the resume, but there was a problem.`,
                ],
                error: error,
            }));
        }
    }
}
exports.PublishResultUseCase = PublishResultUseCase;
