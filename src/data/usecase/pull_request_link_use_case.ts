import {PullRequestRepository} from "../repository/pull_request_repository";
import * as github from "@actions/github";
import {ProjectRepository} from "../repository/project_repository";
import {ParamUseCase} from "./base/param_usecase";
import {Execution} from "../model/execution";

export class PullRequestLinkUseCase implements ParamUseCase<Execution, void> {
    private projectRepository = new ProjectRepository();
    private pullRequestRepository = new PullRequestRepository();

    async invoke(param: Execution): Promise<void> {
        const isLinked = await this.pullRequestRepository.isLinked();

        /**
         * Link Pull Request to projects
         */
        for (const project of param.projects) {
            const prId = github.context.payload.pull_request?.node_id;
            await this.projectRepository.linkContentId(project, prId, param.tokens.tokenPat)
        }

        if (!isLinked) {
            /**
             *  Set the primary/default branch
             */
            const defaultBranch = github.context.payload.repository?.default_branch;
            await this.pullRequestRepository.updateBaseBranch(param.tokens.token, defaultBranch)

            /**
             *  Update PR's description.
             */
            let prBody = github.context.payload.pull_request?.body || '';

            let updatedBody = `${prBody}\n\nResolves #${param.number}`;
            await this.pullRequestRepository.updateDescription(param.tokens.token, updatedBody);

            /**
             *  Await 20 seconds
             */
            await new Promise(resolve => setTimeout(resolve, 20 * 1000));

            /**
             *  Restore the original branch
             */
            const originalBranch = github.context.payload.pull_request?.base.ref || '';
            await this.pullRequestRepository.updateBaseBranch(param.tokens.token, originalBranch)

            /**
             * Restore comment on description
             */
            prBody = github.context.payload.pull_request?.body ?? "";
            updatedBody = prBody.replace(`\n\nResolves #${param.number}`, "");
            await this.pullRequestRepository.updateDescription(param.tokens.token, updatedBody);

            console.log(`Removed "Resolves #${param.number}" from PR description`);
            /**
             * Add comment
             */
            await this.pullRequestRepository.addComment(param.tokens.token, `
## 🛠️ Pull Request Linking Summary

The following actions were performed to ensure the pull request is properly linked to the related issue:
  
1. The base branch was temporarily updated to \`${defaultBranch}\`.
2. The description was temporarily modified to include a reference to issue **#${param.number}**.
3. The base branch was reverted to its original value: \`${originalBranch}\`.
4. The temporary issue reference **#${param.number}** was removed from the description.

Thank you for contributing! 🙌
`);
        }
    }
}