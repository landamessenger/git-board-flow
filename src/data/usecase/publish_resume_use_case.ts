import {IssueRepository} from "../repository/issue_repository";
import {ParamUseCase} from "./base/param_usecase";
import {Execution} from "../model/execution";
import {Result} from "../model/result";
import {getRandomElement} from "../utils/list_utils";
import * as core from '@actions/core';

/**
 * Publish the resume of actions
 */
export class PublishResultUseCase implements ParamUseCase<Execution, void> {
    taskId: string = 'PublishResultUseCase';
    private issueRepository = new IssueRepository();

    async invoke(param: Execution): Promise<void> {
        core.info(`Executing ${this.taskId}.`)

        try {
            /**
             * Comment resume of actions
             */
            let title = '🪄 Automatic Actions'
            let content = ''
            let stupidGif = ''
            let image: string | undefined
            let errors = ''
            let footer = ''
            if (param.isIssue) {
                if (param.issueNotBranched) {
                    title = '🪄 Automatic Actions'
                    image = getRandomElement(param.giphy.issueAutomaticActions)
                } else if (param.release.active) {
                    title = '🚀 Release Actions'
                    image = getRandomElement(param.giphy.issueFeatureGifs)
                } else if (param.hotfix.active) {
                    title = '🔥🐛 Hotfix Actions'
                    image = getRandomElement(param.giphy.issueHotfixGifs)
                } else if (param.isBugfix) {
                    title = '🐛 Bugfix Actions'
                    image = getRandomElement(param.giphy.issueBugfixGifs)
                } else if (param.isFeature) {
                    title = '✨ Feature Actions'
                    image = getRandomElement(param.giphy.issueFeatureGifs)
                }
            } else if (param.isPullRequest) {
                title = '🪄 Automatic Actions'
                image = getRandomElement(param.giphy.pullRequestAutomaticActions)
            }

            if (image) {
                stupidGif = `![image](${image})`
            }

            let indexStep = 0
            param.currentConfiguration.results.forEach(r => {
                for (const step of r.steps) {
                    content += `${indexStep + 1}. ${step}\n`
                    indexStep++
                }
            });

            let indexReminder = 0
            param.currentConfiguration.results.forEach(r => {
                for (const reminder of r.reminders) {
                    footer += `${indexReminder + 1}. ${reminder}\n`
                    indexReminder++
                }
            });

            let indexError = 0
            param.currentConfiguration.results.forEach(r => {
                for (const error of r.errors) {
                    errors += `${indexError + 1}.
\`\`\`
${error}
\`\`\`
`
                    indexError++
                }
            });

            if (footer.length > 0) {
                footer = `
## Reminder

${footer}
`
            }

            if (errors.length > 0) {
                errors = `
## Errors Found

${errors}

Check your project configuration, if everything is okay consider [opening an issue](https://github.com/landamessenger/git-board-flow/issues/new/choose).
`
            }

            const commentBody = `# ${title}
${content}
${errors.length > 0 ? errors : ''}

${stupidGif}

${footer}

Thank you for contributing! 🙌
            `;

            if (content.length === 0) {
                return;
            }

            if (param.isSingleAction) {
                await this.issueRepository.addComment(
                    param.owner,
                    param.repo,
                    param.singleAction.currentSingleActionIssue,
                    commentBody,
                    param.tokens.token,
                )
            } else if (param.isIssue) {
                await this.issueRepository.addComment(
                    param.owner,
                    param.repo,
                    param.issue.number,
                    commentBody,
                    param.tokens.token,
                )
            } else if (param.isPullRequest) {
                await this.issueRepository.addComment(
                    param.owner,
                    param.repo,
                    param.pullRequest.number,
                    commentBody,
                    param.tokens.token,
                )
            }
        } catch (error) {
            console.error(error);
            param.currentConfiguration.results.push(
                new Result({
                    id: this.taskId,
                    success: false,
                    executed: true,
                    steps: [
                        `Tried to publish the resume, but there was a problem.`,
                    ],
                    error: error,
                })
            )
        }
    }
}