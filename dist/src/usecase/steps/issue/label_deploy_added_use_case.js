"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeployAddedUseCase = void 0;
const result_1 = require("../../../data/model/result");
const branch_repository_1 = require("../../../data/repository/branch_repository");
const content_utils_1 = require("../../../utils/content_utils");
const logger_1 = require("../../../utils/logger");
class DeployAddedUseCase {
    constructor() {
        this.taskId = 'DeployAddedUseCase';
        this.branchRepository = new branch_repository_1.BranchRepository();
    }
    async invoke(param) {
        (0, logger_1.logInfo)(`Executing ${this.taskId}.`);
        const result = [];
        try {
            if (param.issue.labeled && param.issue.labelAdded === param.labels.deploy) {
                (0, logger_1.logDebugInfo)(`Deploying requested.`);
                if (param.release.active && param.release.branch !== undefined) {
                    const sanitizedTitle = param.issue.title
                        .replace(/\b\d+(\.\d+){2,}\b/g, '')
                        .replace(/[^\p{L}\p{N}\p{P}\p{Z}^$\n]/gu, '')
                        .replace(/\u200D/g, '')
                        .replace(/[^\S\r\n]+/g, ' ')
                        .replace(/[^a-zA-Z0-9 .]/g, '')
                        .replace(/^-+|-+$/g, '')
                        .replace(/- -/g, '-').trim()
                        .replace(/-+/g, '-')
                        .trim();
                    const description = param.issue.body?.match(/### Changelog\n\n([\s\S]*?)(?=\n\n|$)/)?.[1]?.trim() ?? 'No changelog provided';
                    const escapedDescription = description.replace(/\n/g, '\\n');
                    const releaseUrl = `https://github.com/${param.owner}/${param.repo}/tree/${param.release.branch}`;
                    const parameters = {
                        version: param.release.version,
                        title: sanitizedTitle,
                        changelog: escapedDescription,
                        issue: `${param.issue.number}`,
                    };
                    await this.branchRepository.executeWorkflow(param.owner, param.repo, param.release.branch, param.workflows.release, parameters, param.tokens.token);
                    result.push(new result_1.Result({
                        id: this.taskId,
                        success: true,
                        executed: true,
                        steps: [
                            `Executed release workflow [**${param.workflows.release}**](https://github.com/${param.owner}/${param.repo}/actions/workflows/${param.workflows.release}) on [**${param.release.branch}**](${releaseUrl}).

${(0, content_utils_1.injectJsonAsMarkdownBlock)('Workflow Parameters', parameters)}`
                        ]
                    }));
                }
                else if (param.hotfix.active && param.hotfix.branch !== undefined) {
                    const sanitizedTitle = param.issue.title
                        .replace(/\b\d+(\.\d+){2,}\b/g, '')
                        .replace(/[^\p{L}\p{N}\p{P}\p{Z}^$\n]/gu, '')
                        .replace(/\u200D/g, '')
                        .replace(/[^\S\r\n]+/g, ' ')
                        .replace(/[^a-zA-Z0-9 .]/g, '')
                        .replace(/^-+|-+$/g, '')
                        .replace(/- -/g, '-').trim()
                        .replace(/-+/g, '-')
                        .trim();
                    const description = param.issue.body?.match(/### Hotfix Solution\n\n([\s\S]*?)(?=\n\n|$)/)?.[1]?.trim() ?? 'No changelog provided';
                    const escapedDescription = description.replace(/\n/g, '\\n');
                    const hotfixUrl = `https://github.com/${param.owner}/${param.repo}/tree/${param.hotfix.branch}`;
                    const parameters = {
                        version: param.hotfix.version,
                        title: sanitizedTitle,
                        changelog: escapedDescription,
                        issue: param.issue.number,
                    };
                    await this.branchRepository.executeWorkflow(param.owner, param.repo, param.hotfix.branch, param.workflows.release, parameters, param.tokens.token);
                    result.push(new result_1.Result({
                        id: this.taskId,
                        success: true,
                        executed: true,
                        steps: [
                            `Executed hotfix workflow [**${param.workflows.hotfix}**](https://github.com/${param.owner}/${param.repo}/actions/workflows/${param.workflows.hotfix}) on [**${param.hotfix.branch}**](${hotfixUrl}).

${(0, content_utils_1.injectJsonAsMarkdownBlock)('Workflow Parameters', parameters)}\``
                        ]
                    }));
                }
            }
            else {
                result.push(new result_1.Result({
                    id: this.taskId,
                    success: true,
                    executed: false,
                }));
            }
        }
        catch (error) {
            (0, logger_1.logError)(error);
            result.push(new result_1.Result({
                id: this.taskId,
                success: false,
                executed: true,
                steps: [
                    `Tried to work with workflows, but there was a problem.`,
                ],
                errors: [
                    error?.toString() ?? 'Unknown error',
                ],
            }));
        }
        return result;
    }
}
exports.DeployAddedUseCase = DeployAddedUseCase;
