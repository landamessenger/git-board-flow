import { Execution } from "../../model/execution";
import { Result } from "../../model/result";
import { IssueRepository } from "../../repository/issue_repository";
import { getRandomElement } from "../../utils/list_utils";
import { logDebugInfo, logError, logInfo } from "../../utils/logger";
import { ParamUseCase } from "../base/param_usecase";
import { ExecuteScriptUseCase } from "./execute_script_use_case";

export class NotifyNewCommitOnIssueUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'NotifyNewCommitOnIssueUseCase';

    private issueRepository = new IssueRepository();
    private mergeBranchPattern = 'Merge branch '
    private ghAction = 'gh-action: '
    private separator = '------------------------------------------------------'

    async invoke(param: Execution): Promise<Result[]> {
        logInfo(`Executing ${this.taskId}.`)

        const result: Result[] = []
        try {
            const branchName = param.commit.branch;
            
            let commitPrefix = ''
            if (param.commitPrefixBuilder.length > 0) {
                param.commitPrefixBuilderParams = {
                    branchName: branchName,
                }
                const executor = new ExecuteScriptUseCase();
                const prefixResult = await executor.invoke(param);
                commitPrefix = prefixResult[prefixResult.length - 1].payload['scriptResult'].toString() ?? ''
                logDebugInfo(`Commit prefix: ${commitPrefix}`);
            }

            let title = ''
            let image: string | undefined = ''
            if (param.release.active) {
                title = '🚀 Release News'
                image = getRandomElement(param.images.commitReleaseGifs)
            } else if (param.hotfix.active) {
                title = '🔥🐛 Hotfix News'
                image = getRandomElement(param.images.commitHotfixGifs)
            } else if (param.isBugfix) {
                title = '🐛 Bugfix News'
                image = getRandomElement(param.images.commitBugfixGifs)
            } else if (param.isFeature) {
                title = '✨ Feature News'
                image = getRandomElement(param.images.commitFeatureGifs)
            } else if (param.isDocs) {
                title = '📝 Documentation News'
                image = getRandomElement(param.images.commitDocsGifs)
            } else if (param.isChore) {
                title = '🔧 Chore News'
                image = getRandomElement(param.images.commitChoreGifs)
            } else {
                title = '🪄 Automatic News'
                image = getRandomElement(param.images.commitAutomaticActions)
            }

            let commentBody = `
# ${title}

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

            if (image && param.images.imagesOnCommit) {
                commentBody += `
${this.separator}

![image](${image})
`
            }

            if (param.issue.reopenOnPush) {
                const opened = await this.issueRepository.openIssue(
                    param.owner,
                    param.repo,
                    param.issueNumber,
                    param.tokens.token,
                )

                if (opened) {
                    await this.issueRepository.addComment(
                        param.owner,
                        param.repo,
                        param.issueNumber,
                        `This issue was re-opened after pushing new commits to the branch \`${branchName}\`.`,
                        param.tokens.token,
                    )
                }
            }

            await this.issueRepository.addComment(
                param.owner,
                param.repo,
                param.issueNumber,
                commentBody,
                param.tokens.token,
            )
        } catch (error) {
            logError(error);
            result.push(
                new Result({
                    id: this.taskId,
                    success: false,
                    executed: true,
                    steps: [
                        `Tried to notify the new commit on the issue, but there was a problem.`,
                    ],
                    errors: [
                        error?.toString() ?? 'Unknown error',
                    ],
                })
            )
        }
        return result
    }
}