"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotifyNewCommitOnIssueUseCase = void 0;
const result_1 = require("../../../data/model/result");
const issue_repository_1 = require("../../../data/repository/issue_repository");
const list_utils_1 = require("../../../utils/list_utils");
const logger_1 = require("../../../utils/logger");
const execute_script_use_case_1 = require("../common/execute_script_use_case");
class NotifyNewCommitOnIssueUseCase {
    constructor() {
        this.taskId = 'NotifyNewCommitOnIssueUseCase';
        this.issueRepository = new issue_repository_1.IssueRepository();
        this.mergeBranchPattern = 'Merge branch ';
        this.ghAction = 'gh-action: ';
        this.separator = '------------------------------------------------------';
    }
    async invoke(param) {
        (0, logger_1.logInfo)(`Executing ${this.taskId}.`);
        const result = [];
        try {
            const branchName = param.commit.branch;
            let commitPrefix = '';
            if (param.commitPrefixBuilder.length > 0) {
                param.commitPrefixBuilderParams = {
                    branchName: branchName,
                };
                const executor = new execute_script_use_case_1.ExecuteScriptUseCase();
                const prefixResult = await executor.invoke(param);
                commitPrefix = prefixResult[prefixResult.length - 1].payload['scriptResult'].toString() ?? '';
                (0, logger_1.logDebugInfo)(`Commit prefix: ${commitPrefix}`);
            }
            let title = '';
            let image = '';
            if (param.release.active) {
                title = '🚀 Release News';
                image = (0, list_utils_1.getRandomElement)(param.images.commitReleaseGifs);
            }
            else if (param.hotfix.active) {
                title = '🔥🐛 Hotfix News';
                image = (0, list_utils_1.getRandomElement)(param.images.commitHotfixGifs);
            }
            else if (param.isBugfix) {
                title = '🐛 Bugfix News';
                image = (0, list_utils_1.getRandomElement)(param.images.commitBugfixGifs);
            }
            else if (param.isFeature) {
                title = '✨ Feature News';
                image = (0, list_utils_1.getRandomElement)(param.images.commitFeatureGifs);
            }
            else if (param.isDocs) {
                title = '📝 Documentation News';
                image = (0, list_utils_1.getRandomElement)(param.images.commitDocsGifs);
            }
            else if (param.isChore) {
                title = '🔧 Chore News';
                image = (0, list_utils_1.getRandomElement)(param.images.commitChoreGifs);
            }
            else {
                title = '🪄 Automatic News';
                image = (0, list_utils_1.getRandomElement)(param.images.commitAutomaticActions);
            }
            let commentBody = `
# ${title}

**Changes on branch \`${param.commit.branch}\`:**

`;
            let shouldWarn = false;
            for (const commit of param.commit.commits) {
                commentBody += `
${this.separator}

- ${commit.id} by **${commit.author.name}** (@${commit.author.username})
\`\`\`
${commit.message.replaceAll(`${commitPrefix}: `, '')}
\`\`\`

`;
                if ((commit.message.indexOf(commitPrefix) !== 0 && commitPrefix.length > 0)
                    && commit.message.indexOf(this.mergeBranchPattern) !== 0
                    && commit.message.indexOf(this.ghAction) !== 0) {
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
`;
            }
            if (image && param.images.imagesOnCommit) {
                commentBody += `
${this.separator}

![image](${image})
`;
            }
            if (param.issue.reopenOnPush) {
                const opened = await this.issueRepository.openIssue(param.owner, param.repo, param.issueNumber, param.tokens.token);
                if (opened) {
                    await this.issueRepository.addComment(param.owner, param.repo, param.issueNumber, `This issue was re-opened after pushing new commits to the branch \`${branchName}\`.`, param.tokens.token);
                }
            }
            await this.issueRepository.addComment(param.owner, param.repo, param.issueNumber, commentBody, param.tokens.token);
        }
        catch (error) {
            (0, logger_1.logError)(error);
            result.push(new result_1.Result({
                id: this.taskId,
                success: false,
                executed: true,
                steps: [
                    `Tried to notify the new commit on the issue, but there was a problem.`,
                ],
                errors: [
                    error?.toString() ?? 'Unknown error',
                ],
            }));
        }
        return result;
    }
}
exports.NotifyNewCommitOnIssueUseCase = NotifyNewCommitOnIssueUseCase;
