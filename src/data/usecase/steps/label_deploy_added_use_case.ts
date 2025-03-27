import { Execution } from "../../model/execution";
import { Result } from "../../model/result";
import { BranchRepository } from "../../repository/branch_repository";
import { injectJsonAsMarkdownBlock } from "../../utils/content_utils";
import { logDebugInfo, logError, logInfo } from "../../utils/logger";
import { ParamUseCase } from "../base/param_usecase";

export class DeployAddedUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'DeployAddedUseCase';
    private branchRepository = new BranchRepository();

    async invoke(param: Execution): Promise<Result[]> {
        logInfo(`Executing ${this.taskId}.`)

        const result: Result[] = []
        try {
            if (param.issue.labeled && param.issue.labelAdded === param.labels.deploy) {
                logDebugInfo(`Deploying requested.`)
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
                    
                    const releaseUrl = `https://github.com/${param.owner}/${param.repo}/tree/${param.release.branch}`;
                    const parameters = {
                        version: param.release.version,
                        title: sanitizedTitle,
                        changelog: description,
                        issue: `${param.issue.number}`,
                    }
                    await this.branchRepository.executeWorkflow(
                        param.owner,
                        param.repo,
                        param.release.branch,
                        param.workflows.release,
                        parameters,
                        param.tokens.tokenPat,
                    )
                    result.push(
                        new Result({
                            id: this.taskId,
                            success: true,
                            executed: true,
                            steps: [
                                `Executed release workflow [**${param.workflows.release}**](https://github.com/${param.owner}/${param.repo}/actions/workflows/${param.workflows.release}) on [**${param.release.branch}**](${releaseUrl}).

${injectJsonAsMarkdownBlock('Workflow Parameters', parameters)}`
                            ]
                        })
                    )
                } else if (param.hotfix.active && param.hotfix.branch !== undefined) {
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
                        
                    const hotfixUrl = `https://github.com/${param.owner}/${param.repo}/tree/${param.hotfix.branch}`;
                    const parameters = {
                        version: param.hotfix.version,
                        title: sanitizedTitle,
                        changelog: description,
                        issue: param.issue.number,
                    }
                    await this.branchRepository.executeWorkflow(
                        param.owner,
                        param.repo,
                        param.hotfix.branch,
                        param.workflows.release,
                        parameters,
                        param.tokens.tokenPat,
                    )
                    result.push(
                        new Result({
                            id: this.taskId,
                            success: true,
                            executed: true,
                            steps: [
                                `Executed hotfix workflow [**${param.workflows.hotfix}**](https://github.com/${param.owner}/${param.repo}/actions/workflows/${param.workflows.hotfix}) on [**${param.hotfix.branch}**](${hotfixUrl}).

${injectJsonAsMarkdownBlock('Workflow Parameters', parameters)}\``
                            ]
                        })
                    )
                }
            } else {
                result.push(
                    new Result({
                        id: this.taskId,
                        success: true,
                        executed: false,
                    })
                )
            }
        } catch (error) {
            logError(error);
            result.push(
                new Result({
                    id: this.taskId,
                    success: false,
                    executed: true,
                    steps: [
                        `Tried to work with workflows, but there was a problem.`,
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