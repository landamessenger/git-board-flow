import {ParamUseCase} from "./base/param_usecase";
import {Execution} from "../model/execution";
import {Result} from "../model/result";
import * as core from '@actions/core';
import {IssueRepository} from "../repository/issue_repository";
import {ExecuteScriptUseCase} from "./steps/execute_script_use_case";

export class CommitCheckUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'CommitCheckUseCase';
    private issueRepository = new IssueRepository();
    private mergeBranchPattern = 'Merge branch '
    private ghAction = 'gh-action: '
    private separator = '------------------------------------------------------'

    async invoke(param: Execution): Promise<Result[]> {
        core.info(`Executing ${this.taskId}.`)

        const results: Result[] = []
        try {
            if (param.commit.commits.length === 0) {
                core.info('No commits found in this push.');
                return results;
            }

            const branchName = param.commit.branch;

            let commitPrefix = ''
            if (param.commitPrefixBuilder.length > 0) {
                param.commitPrefixBuilderParams = {
                    branchName: branchName,
                }
                const executor = new ExecuteScriptUseCase();
                const prefixResult = await executor.invoke(param);
                commitPrefix = prefixResult[prefixResult.length - 1].payload['scriptResult'].toString() ?? ''
                core.info(`Commit prefix: ${commitPrefix}`);
            }

            core.info(`Branch: ${param.commit.branch}`);
            core.info(`Commits detected: ${param.commit.commits.length}`);
            core.info(`Commits detected: ${param.number}`);

            let commentBody = `
# 🎉  News

**Changes on branch \`${param.commit.branch}\`:**

`

            let shouldWarn = false
            for (const commit of param.commit.commits) {
                commentBody += `
${this.separator}

- ${commit.id} by **${commit.author.name}** (@${commit.author.username})
\`\`\`
${commit.message.replaceAll(`${commitPrefix}: `, '')}
\`\`\`

`;
                if (
                    (commit.message.indexOf(commitPrefix) !== 0 && commitPrefix.length > 0)
                    && commit.message.indexOf(this.mergeBranchPattern) !== 0
                    && commit.message.indexOf(this.ghAction) !== 0
                ) {
                    shouldWarn = true;
                }
            }

            if (shouldWarn && commitPrefix.length > 0) {
                commentBody += `
${this.separator}
## ⚠️ Attention

One or more commits didn't start with the prefix **${commitPrefix}**.

\`\`\`
${commitPrefix}: created hello-world app
\`\`\`
`
            }

            if (param.issue.reopenOnPush) {
                const opened = await this.issueRepository.openIssue(
                    param.owner,
                    param.repo,
                    param.number,
                    param.tokens.token,
                )

                if (opened) {
                    await this.issueRepository.addComment(
                        param.owner,
                        param.repo,
                        param.number,
                        `This issue was re-opened after pushing new commits to the branch \`${branchName}\`.`,
                        param.tokens.token,
                    )
                }
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