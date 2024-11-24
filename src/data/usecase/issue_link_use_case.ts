import {IssueRepository} from "../repository/issue_repository";
import {BranchRepository} from "../repository/branch_repository";
import {ParamUseCase} from "./base/param_usecase";
import {Execution} from "../model/execution";
import {Config} from "../model/config";
import {LinkIssueProjectUseCase} from "./steps/link_issue_project_use_case";
import {UpdateTitleUseCase} from "./steps/update_title_use_case";
import {PrepareBranchesUseCase} from "./steps/prepare_branches_use_case";
import {RemoveNotNeededBranchesUseCase} from "./steps/remove_not_needed_branches_use_case";
import {Result} from "../model/result";

export class IssueLinkUseCase implements ParamUseCase<Execution, void> {
    taskId: string = 'IssueLinkUseCase';
    private issueRepository = new IssueRepository();
    private branchRepository = new BranchRepository();

    async invoke(param: Execution): Promise<void> {
        const results: Result[] = []

        /**
         * Issue Description
         */
        const config = await this.issueRepository.readIssueBranchConfig(
            param.owner,
            param.repo,
            param.issue.number,
            param.tokens.token,
        )

        const branches = await this.branchRepository.getListOfBranches(
            param.owner,
            param.repo,
            param.tokens.token,
        )

        console.log(JSON.stringify(config, null, 2));

        /**
         * Link issue to project
         */
        results.push(...await new LinkIssueProjectUseCase().invoke(param));

        /**
         * Update title
         */
        results.push(...await new UpdateTitleUseCase().invoke(param));

        /**
         * When hotfix, prepare it first
         */
        results.push(...await new PrepareBranchesUseCase().invoke(param));

        /**
         * Remove unnecessary branches
         */
        results.push(...await new RemoveNotNeededBranchesUseCase().invoke(param));

        /**
         * Issue Description
         */
        await this.issueRepository.updateIssueBranchConfig(
            param.owner,
            param.repo,
            param.issue.number,
            new Config({
                branchConfiguration: {
                    name: 'tags/1.0.0',
                    oid: '123ekdj1b3ldjb',
                    children: [
                        {
                            name: 'hotfix/1.0.1',
                            oid: '123ekdj1b3ldjb',
                            children: [
                                {
                                    name: 'bugfix/2-issue-b',
                                    oid: '123ekdj1b3ldjb',
                                    children: []
                                }
                            ]
                        }
                    ]
                }
            }),
            param.tokens.token,
        )

        /**
         * Comment resume of actions
         */
        let title = ''
        let content = ''
        let footer = ''

        if (param.hotfix.active) {
            title = '🔥🐛 Hotfix Actions'
        } else if (param.isBugfix) {
            title = '🐛 Bugfix Actions'
        } else if (param.isFeature) {
            title = '🛠️ Feature Actions'
        }

        let extra = 0
        for (let i = 0; i < results.length; i++) {
            const r = results[i];
            for (const step of r.steps) {
                content += `${i + 1 + extra}. ${step}\n`
                extra++
            }
        }

        let extraReminder = 0
        for (let i = 0; i < results.length; i++) {
            const r = results[i];
            for (const reminder of r.reminders) {
                footer += `${i + 1 + extraReminder}. ${reminder}\n`
                extraReminder++
            }
        }

        if (footer.length > 0) {
            footer = `
### Reminder

${footer}
`
        }

        const commentBody = `## ${title}:
${content}
${footer}
            `;

        await this.issueRepository.addComment(
            param.owner,
            param.repo,
            param.issue.number,
            commentBody,
            param.tokens.token,
        )
    }
}