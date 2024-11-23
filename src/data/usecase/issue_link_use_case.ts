import * as core from "@actions/core";
import {ProjectRepository} from "../repository/project_repository";
import {IssueRepository} from "../repository/issue_repository";
import {BranchRepository} from "../repository/branch_repository";
import {ParamUseCase} from "./base/param_usecase";
import {Execution} from "../model/execution";

export class IssueLinkUseCase implements ParamUseCase<Execution, void> {
    private issueRepository = new IssueRepository();
    private projectRepository = new ProjectRepository();
    private branchRepository = new BranchRepository();

    async invoke(param: Execution): Promise<void> {
        const issueTitle: string = param.issue.title;
        if (issueTitle.length === 0) {
            core.setFailed('Issue title not available.');
            return;
        }
        const sanitizedTitle = this.branchRepository.formatBranchName(issueTitle, param.number)
        const deletedBranches = []

        /**
         * Link issue to project
         */
        for (const project of param.projects) {
            const issueId = await this.issueRepository.getId(
                param.owner,
                param.repo,
                param.issue.number,
                param.tokens.token,
            )
            await this.projectRepository.linkContentId(project, issueId, param.tokens.tokenPat)
        }

        /**
         * Fetch all branches/tags
         */
        await this.branchRepository.fetchRemoteBranches();

        param.hotfix.active = await this.issueRepository.isHotfix(
            param.owner,
            param.repo,
            param.issue.number,
            param.labels.hotfix,
            param.tokens.token,
        );

        /**
         * Update title
         */
        if (param.emojiLabeledTitle) {
            await this.issueRepository.updateTitle(
                param.owner,
                param.repo,
                param.issue.title,
                param.issue.number,
                param.branchType,
                param.hotfix.active,
                param.labels.isQuestion,
                param.labels.isHelp,
                param.tokens.token,
            );
        }

        /**
         * When hotfix, prepare it first
         */
        const lastTag = await this.branchRepository.getLatestTag();
        if (param.hotfix.active && lastTag !== undefined) {
            const branchOid = await this.branchRepository.getCommitTag(lastTag)
            const incrementHotfixVersion = (version: string) => {
                const parts = version.split('.').map(Number);
                parts[parts.length - 1] += 1;
                return parts.join('.');
            };

            param.hotfix.version = incrementHotfixVersion(lastTag);

            const baseBranchName = `tags/${lastTag}`;
            param.hotfix.branch = `hotfix/${param.hotfix.version}`;

            core.info(`Tag branch: ${baseBranchName}`);
            core.info(`Hotfix branch: ${param.hotfix.branch}`);

            const result = await this.branchRepository.createLinkedBranch(
                param.owner,
                param.repo,
                baseBranchName,
                param.hotfix.branch,
                param.number,
                branchOid,
                param.tokens.tokenPat,
            )

            core.info(`Hotfix branch successfully linked to issue: ${JSON.stringify(result)}`);
        }

        core.info(`Branch type: ${param.branchType}`);

        param.branches.replacedBranch = await this.branchRepository.manageBranches(
            param.owner,
            param.repo,
            param.number,
            issueTitle,
            param.branchType,
            param.branches.development,
            param.hotfix?.branch,
            param.hotfix.active,
            param.tokens.tokenPat,
        );

        /**
         * Remove unnecessary branches
         */
        const branches = await this.branchRepository.getListOfBranches(
            param.owner,
            param.repo,
            param.tokens.token,
        );

        const finalBranch = `${param.branchType}/${param.number}-${sanitizedTitle}`;

        const branchTypes = ["feature", "bugfix"];
        for (const type of branchTypes) {
            let branchName = `${type}/${param.number}-${sanitizedTitle}`;
            const prefix = `${type}/${param.number}-`;

            if (type !== param.branchType) {
                const matchingBranch = branches.find(branch => branch.indexOf(prefix) > -1);
                if (!matchingBranch) {
                    continue;
                }

                branchName = matchingBranch;
                const removed = await this.branchRepository.removeBranch(
                    param.owner,
                    param.repo,
                    branchName,
                    param.tokens.token,
                )
                if (removed) {
                    deletedBranches.push(branchName)
                } else {
                    core.error(`Error deleting ${branchName}`);
                }
            } else {
                for (const branch of branches) {
                    if (branch.indexOf(prefix) > -1 && branch !== finalBranch) {
                        const removed = await this.branchRepository.removeBranch(
                            param.owner,
                            param.repo,
                            branch,
                            param.tokens.token,
                        )
                        if (removed) {
                            deletedBranches.push(branch)
                        } else {
                            core.error(`Error deleting ${branch}`);
                        }
                    }
                }
            }
        }

        /**
         * Comment resume of actions
         */

        const tagBranch = `tags/${lastTag}`;
        const tagUrl = `https://github.com/${param.owner}/${param.repo}/tree/${tagBranch}`;

        const originBranch = param.branches.replacedBranch ?? param.branches.development;
        const originUrl = `https://github.com/${param.owner}/${param.repo}/tree/${originBranch}`;

        let developmentBranch = param.branches.development;
        let developmentUrl = `https://github.com/${param.owner}/${param.repo}/tree/${developmentBranch}`;

        const hotfixUrl = `https://github.com/${param.owner}/${param.repo}/tree/${param.hotfix.branch}`;

        const newBranchName = `${param.branchType}/${param.number}-${sanitizedTitle}`;
        const newRepoUrl = `https://github.com/${param.owner}/${param.repo}/tree/${newBranchName}`;

        let deletedBranchesMessage = ''
        let title = ''
        let content = ''
        let footer = ''
        let stepOn = 1

        if (param.hotfix.active) {
            title = '🔥🐛 Hotfix Actions'
            content = `
1. The tag [\`${tagBranch}\`](${tagUrl}) was used to create the branch [\`${param.hotfix.branch}\`](${hotfixUrl}).
2. The branch [\`${param.hotfix.branch}\`](${hotfixUrl}) was used to create the branch [\`${newBranchName}\`](${newRepoUrl}).
`
            footer = `
### Reminder
1. Make yourself a coffee ☕.
2. Commit the necessary changes to [\`${newBranchName}\`](${newRepoUrl}).
3. Open a Pull Request from [\`${newBranchName}\`](${newRepoUrl}) to [\`${param.hotfix.branch}\`](${hotfixUrl}). [New PR](https://github.com/${param.owner}/${param.repo}/compare/${param.hotfix.branch}...${newBranchName}?expand=1)
4. After merging into [\`${param.hotfix.branch}\`](${hotfixUrl}), create the tag \`tags/${param.hotfix.version}\`.
5. Open a Pull Request from [\`${param.hotfix.branch}\`](${hotfixUrl}) to [\`${developmentBranch}\`](${developmentUrl}). [New PR](https://github.com/${param.owner}/${param.repo}/compare/${developmentBranch}...${param.hotfix.branch}?expand=1)
`
            stepOn = 2
        } else if (param.isBugfix) {
            title = '🐛 Bugfix Actions'
            content = `
1. The branch [\`${originBranch}\`](${originUrl}) was used to create the branch [\`${newBranchName}\`](${newRepoUrl}).
`
            footer = `
### Reminder
1. Make yourself a coffee ☕.
2. Commit the necessary changes to [\`${newBranchName}\`](${newRepoUrl}).
3. Open a Pull Request from [\`${newBranchName}\`](${newRepoUrl}) to [\`${developmentBranch}\`](${developmentUrl}). [New PR](https://github.com/${param.owner}/${param.repo}/compare/${developmentBranch}...${newBranchName}?expand=1)
`

        } else if (param.isFeature) {
            title = '🛠️ Feature Actions'
            content = `
1. The branch [\`${originBranch}\`](${originUrl}) was used to create the branch [\`${newBranchName}\`](${newRepoUrl}).
`
            footer = `
### Reminder
1. Make yourself a coffee ☕.
2. Commit the necessary changes to [\`${newBranchName}\`](${newRepoUrl}).
3. Open a Pull Request from [\`${newBranchName}\`](${newRepoUrl}) to [\`${developmentBranch}\`](${developmentUrl}). [New PR](https://github.com/${param.owner}/${param.repo}/compare/${developmentBranch}...${newBranchName}?expand=1)
`
        }

        for (let i = 0; i < deletedBranches.length; i++) {
            const branch = deletedBranches[i];
            deletedBranchesMessage += `${stepOn + i + 1}. The branch \`${branch}\` was removed.\n`
        }

        const commentBody = `## ${title}:
            ${content}
            ${deletedBranchesMessage}
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