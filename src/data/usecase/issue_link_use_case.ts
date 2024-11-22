import * as core from "@actions/core";
import {ProjectRepository} from "../repository/project_repository";
import {UseCase} from "./base/usecase";
import {IssueRepository} from "../repository/issue_repository";
import {BranchRepository} from "../repository/branch_repository";
import * as github from "@actions/github";

export class IssueLinkUseCase implements UseCase<void> {
    private issueRepository = new IssueRepository();
    private projectRepository = new ProjectRepository();
    private branchRepository = new BranchRepository();

    private projectUrlsInput = core.getInput('project-urls', {required: true});
    private projectUrls: string[] = this.projectUrlsInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);

    private token = core.getInput('github-token', {required: true});
    private tokenPat = core.getInput('github-token-personal', {required: true});
    private branchManagementLabel = core.getInput('branch-management-label', {required: true});
    private defaultBranch = core.getInput('default-branch', {required: true});
    private developmentBranch = core.getInput('development-branch', {required: true});

    private isHotfix: boolean = false;
    private hotfixVersion: string = '';
    private hotfixBranch: string = '';
    private featureBugfixBranchOrigin: string | undefined;

    async invoke(): Promise<void> {
        const issueNumber = github.context.payload.issue?.number;
        const issueTitle: string | undefined = github.context.payload.issue?.title;
        if (!issueNumber || !issueTitle) {
            core.setFailed('Issue number not available.');
            return;
        }
        const sanitizedTitle = this.branchRepository.formatBranchName(issueTitle, issueNumber)
        const deletedBranches = []

        /**
         * Link issue to project
         */
        for (const projectUrl of this.projectUrls) {
            const projectId = await this.projectRepository.getProjectId(projectUrl, this.tokenPat)
            const issueId = await this.issueRepository.getId(this.token)
            await this.projectRepository.linkContentId(projectId, issueId, this.tokenPat)
        }

        /**
         * Fetch all branches/tags
         */
        await this.branchRepository.fetchRemoteBranches();

        /**
         * Update title
         */
        await this.issueRepository.updateTitle(this.token);

        /**
         * Get last tag for hotfix
         */
        const lastTag = await this.branchRepository.getLatestTag();

        /**
         * Get issue labels
         */
        const labels = await this.issueRepository.getIssueLabels(this.token);
        console.log(`Founds labels: ${labels.join(', ')}`);

        if (!labels.includes(this.branchManagementLabel)) {
            /**
             * Remove any branch created for this issue
             */

            const branchTypes = ["feature", "bugfix"];

            const branches = await this.branchRepository.getListOfBranches(this.token);


            for (const type of branchTypes) {
                let branchName = `${type}/${issueNumber}-${sanitizedTitle}`;
                const prefix = `${type}/${issueNumber}-`;

                const matchingBranch = branches.find(branch => branch.indexOf(prefix) > -1);

                if (!matchingBranch) continue;

                branchName = matchingBranch;
                core.info(`Found branch: ${branchName}`);

                const removed = await this.branchRepository.removeBranch(this.token, branchName);
                if (removed) {
                    deletedBranches.push(branchName);
                }
            }

            let deletedBranchesMessage = ''
            for (let i = 0; i < deletedBranches.length; i++) {
                const branch = deletedBranches[i];
                deletedBranchesMessage += `\n${i + 1}. The branch \`${branch}\` was removed.`
            }

            const commentBody = `## 🗑️ Cleanup Actions:
${deletedBranchesMessage}
            `;

            await this.issueRepository.addComment(this.token, commentBody);

            return
        }

        this.isHotfix = await this.issueRepository.isHotfix(this.token);

        /**
         * When hotfix, prepare it first
         */
        if (this.isHotfix && lastTag !== undefined) {
            const branchOid = await this.branchRepository.getCommitTag(lastTag)
            const incrementHotfixVersion = (version: string) => {
                const parts = version.split('.').map(Number);
                parts[parts.length - 1] += 1;
                return parts.join('.');
            };

            this.hotfixVersion = incrementHotfixVersion(lastTag);

            const baseBranchName = `tags/${lastTag}`;
            this.hotfixBranch = `hotfix/${this.hotfixVersion}`;

            console.log(`Tag branch: ${baseBranchName}`);
            console.log(`Hotfix branch: ${this.hotfixBranch}`);

            const result = await this.branchRepository.createLinkedBranch(
                this.tokenPat,
                baseBranchName,
                this.hotfixBranch,
                issueNumber,
                branchOid
            )

            console.log(`Hotfix branch successfully linked to issue: ${JSON.stringify(result)}`);
        }

        const branchType = await this.issueRepository.branchesForIssue(this.token);

        console.log(`Branch type: ${branchType}`);

        this.featureBugfixBranchOrigin = await this.branchRepository.manageBranches(this.tokenPat,
            issueNumber,
            issueTitle,
            branchType,
            this.developmentBranch,
            this.hotfixBranch,
            this.isHotfix,
        );

        /**
         * Remove unnecessary branches
         */
        const branches = await this.branchRepository.getListOfBranches(this.token);

        const finalBranch = `${branchType}/${issueNumber}-${sanitizedTitle}`;

        const branchTypes = ["feature", "bugfix"];
        for (const type of branchTypes) {
            let branchName = `${type}/${issueNumber}-${sanitizedTitle}`;
            const prefix = `${type}/${issueNumber}-`;

            if (type !== branchType) {
                const matchingBranch = branches.find(branch => branch.indexOf(prefix) > -1);
                if (!matchingBranch) {
                    continue;
                }

                branchName = matchingBranch;
                core.info(`Found branch for deletion ${branchName}`);

                const removed = await this.branchRepository.removeBranch(this.token, branchName)
                if (removed) {
                    core.info(`Deleted ${branchName}`);
                    deletedBranches.push(branchName)
                } else {
                    core.error(`Error deleting ${branchName}`);
                }
            } else {
                for (const branch of branches) {
                    if (branch.indexOf(prefix) > -1 && branch !== finalBranch) {
                        const removed = await this.branchRepository.removeBranch(this.token, branch)
                        if (removed) {
                            core.info(`Deleted ${branch}`);
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
        const isBugfix = branchType === 'bugfix';
        const isFeature = branchType === 'feature';
        const tagBranch = `tags/${lastTag}`;
        const tagUrl = `https://github.com/${github.context.repo.owner}/${github.context.repo.repo}/tree/${tagBranch}`;

        const featureOriginBranch = this.featureBugfixBranchOrigin;
        const featureOriginUrl = `https://github.com/${github.context.repo.owner}/${github.context.repo.repo}/tree/${featureOriginBranch}`;

        const defaultBranch = this.developmentBranch;
        const defaultUrl = `https://github.com/${github.context.repo.owner}/${github.context.repo.repo}/tree/${defaultBranch}`;

        let developmentBranch = defaultBranch;
        let developmentUrl = defaultUrl;

        const hotfixUrl = `https://github.com/${github.context.repo.owner}/${github.context.repo.repo}/tree/${this.hotfixBranch}`;

        const newBranchName = `${branchType}/${issueNumber}-${sanitizedTitle}`;
        const newRepoUrl = `https://github.com/${github.context.repo.owner}/${github.context.repo.repo}/tree/${newBranchName}`;

        let deletedBranchesMessage = ''
        if (!this.isHotfix) {
            for (let i = 0; i < deletedBranches.length; i++) {
                const branch = deletedBranches[i];
                if (branch.indexOf('feature/') > -1 || branch.indexOf('bugfix/') > -1) {
                    developmentBranch = branch;
                    developmentUrl = `https://github.com/${github.context.repo.owner}/${github.context.repo.repo}/tree/${developmentBranch}`;
                }
            }
        }

        let title = ''
        let content = ''
        let footer = ''
        let stepOn = 1

        if (this.isHotfix) {
            title = '🔥🐛 Hotfix Actions'
            content = `
1. The tag [\`${tagBranch}\`](${tagUrl}) was used to create the branch [\`${this.hotfixBranch}\`](${hotfixUrl}).
2. The branch [\`${this.hotfixBranch}\`](${hotfixUrl}) was used to create the branch [\`${newBranchName}\`](${newRepoUrl}).
              `
            footer = `
### Reminder
1. Make yourself a coffee ☕.
2. Commit the necessary changes to [\`${newBranchName}\`](${newRepoUrl}).
3. Open a Pull Request from [\`${newBranchName}\`](${newRepoUrl}) to [\`${this.hotfixBranch}\`](${hotfixUrl}). [New PR](https://github.com/${github.context.repo.owner}/${github.context.repo.repo}/compare/${this.hotfixBranch}...${newBranchName}?expand=1)
4. After merging into [\`${this.hotfixBranch}\`](${hotfixUrl}), create the tag \`tags/${this.hotfixVersion}\`.
5. Open a Pull Request from [\`${this.hotfixBranch}\`](${hotfixUrl}) to [\`${developmentBranch}\`](${developmentUrl}). [New PR](https://github.com/${github.context.repo.owner}/${github.context.repo.repo}/compare/${developmentBranch}...${this.hotfixBranch}?expand=1)
              `
            stepOn = 2
        } else if (isBugfix) {
            title = '🐛 Bugfix Actions'
            content = `
1. The branch [\`${featureOriginBranch}\`](${featureOriginUrl}) was used to create the branch [\`${newBranchName}\`](${newRepoUrl}).
              `
            footer = `
### Reminder
1. Make yourself a coffee ☕.
2. Commit the necessary changes to [\`${newBranchName}\`](${newRepoUrl}).
3. Open a Pull Request from [\`${newBranchName}\`](${newRepoUrl}) to [\`${developmentBranch}\`](${developmentUrl}). [New PR](https://github.com/${github.context.repo.owner}/${github.context.repo.repo}/compare/${developmentBranch}...${newBranchName}?expand=1)
              `

        } else if (isFeature) {
            title = '🛠️ Feature Actions'
            content = `
1. The branch [\`${featureOriginBranch}\`](${featureOriginUrl}) was used to create the branch [\`${newBranchName}\`](${newRepoUrl}).
              `
            footer = `
### Reminder
1. Make yourself a coffee ☕.
2. Commit the necessary changes to [\`${newBranchName}\`](${newRepoUrl}).
3. Open a Pull Request from [\`${newBranchName}\`](${newRepoUrl}) to [\`${developmentBranch}\`](${developmentUrl}). [New PR](https://github.com/${github.context.repo.owner}/${github.context.repo.repo}/compare/${developmentBranch}...${newBranchName}?expand=1)
`
        }

        for (let i = 0; i < deletedBranches.length; i++) {
            const branch = deletedBranches[i];
            deletedBranchesMessage += `\n${stepOn + i + 1}. The branch \`${branch}\` was removed.`
        }

        const commentBody = `## ${title}:
            ${content}
            ${deletedBranchesMessage}
            ${footer}
            `;

        await this.issueRepository.addComment(this.token, commentBody)

        console.log(`Commented on issue #${issueNumber}`);
    }
}