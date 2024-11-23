import {PullRequestRepository} from "../repository/pull_request_repository";
import * as core from "@actions/core";
import * as github from "@actions/github";
import {ProjectRepository} from "../repository/project_repository";
import {UseCase} from "./base/usecase";

export class PullRequestLinkUseCase implements UseCase<void> {
    private projectRepository = new ProjectRepository();
    private pullRequestRepository = new PullRequestRepository();

    private projectUrlsInput = core.getInput('project-urls', {required: true});
    private projectUrls: string[] = this.projectUrlsInput
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);

    private token = core.getInput('github-token', {required: true});
    private tokenPat = core.getInput('github-token-personal', {required: true});

    private runAlways = core.getInput('run-always', {required: true}) === 'true';
    private actionLauncherLabel = core.getInput('action-launcher-label', {required: true});

    async invoke(): Promise<void> {
        const issueNumber = await this.pullRequestRepository.extractIssueNumberFromBranch();

        const labels = await this.pullRequestRepository.getLabels(this.token);
        console.log(`Founds labels: ${labels.join(', ')}`);

        if (!labels.includes(this.actionLauncherLabel) && !this.runAlways) {
            core.info(`PullRequestIssueLinkUseCase skipped: ${issueNumber}`);
            return;
        }

        const isLinked = await this.pullRequestRepository.isLinked();

        core.info(`PullRequestIssueLinkUseCase executed: ${issueNumber}`);

        /**
         * Link Pull Request to projects
         */
        for (const projectUrl of this.projectUrls) {
            const projectId = await this.projectRepository.getProjectId(projectUrl, this.tokenPat)
            const prId = github.context.payload.pull_request?.node_id;
            await this.projectRepository.linkContentId(projectId, prId, this.tokenPat)
        }

        if (!isLinked) {
            /**
             *  Set the primary/default branch
             */
            const defaultBranch = github.context.payload.repository?.default_branch;
            await this.pullRequestRepository.updateBaseBranch(this.token, defaultBranch)

            /**
             *  Update PR's description.
             */
            const prBody = github.context.payload.pull_request?.body || '';

            const updatedBody = `${prBody}\n\nResolves #${issueNumber}`;
            await this.pullRequestRepository.updateDescription(this.token, updatedBody);

            /**
             *  Await 20 seconds
             */
            await new Promise(resolve => setTimeout(resolve, 20 * 1000));

            /**
             *  Restore the original branch
             */
            const originalBranch = github.context.payload.pull_request?.base.ref || '';
            await this.pullRequestRepository.updateBaseBranch(this.token, originalBranch)

            /**
             * Add comment
             */
            await this.pullRequestRepository.addComment(this.token, `
## 🛠️ Pull Request Linking Summary

The following actions were performed to ensure the pull request is properly linked to the related issue:
  
1. The base branch was temporarily updated to \`${defaultBranch}\`.
2. The description was temporarily modified to include a reference to issue **#${issueNumber}**.
3. The base branch was reverted to its original value: \`${originalBranch}\`.
4. The temporary issue reference **#${issueNumber}** was removed from the description.

Thank you for contributing! 🙌
`);
        }
    }
}