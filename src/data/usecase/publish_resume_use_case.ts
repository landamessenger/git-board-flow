import {IssueRepository} from "../repository/issue_repository";
import {ParamUseCase} from "./base/param_usecase";
import {Execution} from "../model/execution";
import {Result} from "../model/result";
import {PullRequestRepository} from "../repository/pull_request_repository";

/**
 * Publish the resume of actions
 */
export class PublishResultUseCase implements ParamUseCase<Execution, void> {
    taskId: string = 'PublishResultUseCase';
    private issueRepository = new IssueRepository();
    private pullRequestRepository = new PullRequestRepository();

    async invoke(param: Execution): Promise<void> {
        try {
            /**
             * Comment resume of actions
             */
            let title = ''
            let content = ''
            let footer = ''
            if (param.issueAction) {
                if (param.mustCleanAll) {
                    title = '🗑️ Cleanup Actions'
                } else if (param.hotfix.active) {
                    title = '🔥🐛 Hotfix Actions'
                } else if (param.isBugfix) {
                    title = '🐛 Bugfix Actions'
                } else if (param.isFeature) {
                    title = '🛠️ Feature Actions'
                }
            } else if (param.pullRequestAction) {
                title = '🛠️ Pull Request Linking Summary'
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

            if (footer.length > 0) {
                footer = `
### Reminder

${footer}
`
            }

            const commentBody = `## ${title}:
${content}
${footer}

Thank you for contributing! 🙌
            `;

            if (content.length === 0) {
                return;
            }

            if (param.issueAction) {
                await this.issueRepository.addComment(
                    param.owner,
                    param.repo,
                    param.issue.number,
                    commentBody,
                    param.tokens.token,
                )
            } else if (param.pullRequestAction) {
                await this.pullRequestRepository.addComment(
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