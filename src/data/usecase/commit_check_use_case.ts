import {ParamUseCase} from "./base/param_usecase";
import {Execution} from "../model/execution";
import {Result} from "../model/result";
import {LinkPullRequestProjectUseCase} from "./steps/link_pull_request_project_use_case";
import {LinkPullRequestIssueUseCase} from "./steps/link_pull_request_issue_use_case";
import * as core from '@actions/core';
import {IssueRepository} from "../repository/issue_repository";

export class CommitCheckUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'CommitCheckUseCase';
    private issueRepository = new IssueRepository();

    async invoke(param: Execution): Promise<Result[]> {
        const results: Result[] = []
        try {
            if (param.commit.commits.length === 0) {
                core.info('No commits found in this push.');
                return results;
            }

            core.info(`Branch: ${param.commit.branch}`);
            core.info(`Commits detected: ${param.commit.commits.length}`);
            core.info(`Commits detected: ${param.number}`);

            let commentBody = `
# 🎉  News

**Changes on branch \`${param.commit.branch}\`:**

------------------------------------------------------
`

            let shouldWarn = false
            for (const commit of param.commit.commits) {
                commentBody += `
- ${commit.id} 
\`\`\`
${commit.message}
\`\`\`

------------------------------------------------------
`;
                if (commit.message.indexOf(param.commit.branch) !== 0) {
                    shouldWarn = true;
                }
            }

            if (shouldWarn) {
                commentBody += `
### ⚠️ Attention

One or more commits should start with the prefix **${param.commit.prefix}**.

\`\`\`
${param.commit.prefix}: created hello-world app
\`\`\`
`
            }

            await this.issueRepository.addComment(
                param.owner,
                param.repo,
                param.number,
                commentBody,
                param.tokens.token,
            )
        } catch (error) {
            console.error(error);
            results.push(
                new Result({
                    id: this.taskId,
                    success: false,
                    executed: true,
                    steps: [
                        `Error linking projects/issues with pull request.`,
                    ],
                    error: error,
                })
            )
        }
        return results;
    }
}