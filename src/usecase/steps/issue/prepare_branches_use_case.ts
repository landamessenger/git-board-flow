import * as core from "@actions/core";
import { Execution } from "../../../data/model/execution";
import { Result } from "../../../data/model/result";
import { BranchRepository } from "../../../data/repository/branch_repository";
import { logDebugInfo, logError, logInfo } from "../../../utils/logger";
import { ParamUseCase } from "../../base/param_usecase";
import { ExecuteScriptUseCase } from "../common/execute_script_use_case";
import { MoveIssueToInProgressUseCase } from "./move_issue_to_in_progress";

export class PrepareBranchesUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'PrepareBranchesUseCase';
    
    private branchRepository = new BranchRepository();

    async invoke(param: Execution): Promise<Result[]> {
        logInfo(`Executing ${this.taskId}.`)

        const result: Result[] = []
        try {
            const issueTitle: string = param.issue.title;
            if (!param.labels.isMandatoryBranchedLabel && issueTitle.length === 0) {
                core.setFailed('Issue title not available.');
                result.push(
                    new Result({
                        id: this.taskId,
                        success: false,
                        executed: false,
                        reminders: [
                            `Tried to check the title but no one was found.`
                        ]
                    })
                )
                return result;
            }

            /**
             * Fetch all branches/tags
             */
            await this.branchRepository.fetchRemoteBranches();

            result.push(
                new Result({
                    id: this.taskId,
                    success: true,
                    executed: true,
                    reminders: [
                        `Take a coffee break while you work ☕.`
                    ]
                })
            )
            const branches = await this.branchRepository.getListOfBranches(
                param.owner,
                param.repo,
                param.tokens.token,
            )
            logDebugInfo('Available branches:');
            branches.forEach(branch => {
                logDebugInfo(`- ${branch}`);
            });

            if (param.hotfix.active) {
                if (param.hotfix.baseVersion !== undefined && param.hotfix.version !== undefined && param.hotfix.branch !== undefined && param.hotfix.baseBranch !== undefined) {
                    const branchOid = await this.branchRepository.getCommitTag(param.hotfix.baseVersion)

                    const tagUrl = `https://github.com/${param.owner}/${param.repo}/tree/${param.hotfix.baseBranch}`;
                    const hotfixUrl = `https://github.com/${param.owner}/${param.repo}/tree/${param.hotfix.branch}`;

                    logDebugInfo(`Tag branch: ${param.hotfix.baseBranch}`);
                    logDebugInfo(`Hotfix branch: ${param.hotfix.branch}`);

                    param.currentConfiguration.parentBranch = param.hotfix.baseBranch
                    param.currentConfiguration.hotfixBranch = param.hotfix.branch
                    param.currentConfiguration.workingBranch = param.hotfix.branch;

                    if (branches.indexOf(param.hotfix.branch) === -1) {
                        const linkResult = await this.branchRepository.createLinkedBranch(
                            param.owner,
                            param.repo,
                            param.hotfix.baseBranch,
                            param.hotfix.branch,
                            param.issueNumber,
                            branchOid,
                            param.tokens.token,
                        )

                        if (linkResult[linkResult.length - 1].success) {
                            result.push(
                                new Result({
                                    id: this.taskId,
                                    success: true,
                                    executed: true,
                                    steps: [
                                        `The tag [**${param.hotfix.baseBranch}**](${tagUrl}) was used to create the branch [**${param.hotfix.branch}**](${hotfixUrl})`,
                                    ],
                                })
                            )
                            logDebugInfo(`Hotfix branch successfully linked to issue: ${JSON.stringify(linkResult)}`);
                        }
                    } else {
                        result.push(
                            new Result({
                                id: this.taskId,
                                success: true,
                                executed: true,
                                steps: [
                                    `The branch [**${param.hotfix.branch}**](${hotfixUrl}) already exists and will not be created from the tag [**${param.hotfix.baseBranch}**](${tagUrl}).`,
                                ],
                            })
                        )
                    }
                } else {
                    result.push(
                        new Result({
                            id: this.taskId,
                            success: false,
                            executed: true,
                            steps: [
                                `Tried to create a hotfix but no tag was found.`,
                            ]
                        })
                    )
                    return result
                }
            } else if (param.release.active) {
                if (param.release.version !== undefined && param.release.branch !== undefined) {
                    param.currentConfiguration.releaseBranch = param.release.branch;
                    param.currentConfiguration.workingBranch = param.release.branch;

                    logDebugInfo(`Release branch: ${param.release.branch}`);
                    param.currentConfiguration.parentBranch = param.branches.development

                    const developmentUrl = `https://github.com/${param.owner}/${param.repo}/tree/${param.branches.development}`;
                    const releaseUrl = `https://github.com/${param.owner}/${param.repo}/tree/${param.release.branch}`;
                    const mainUrl = `https://github.com/${param.owner}/${param.repo}/tree/${param.branches.defaultBranch}`;

                    if (branches.indexOf(param.release.branch) === -1) {
                        const linkResult = await this.branchRepository.createLinkedBranch(
                            param.owner,
                            param.repo,
                            param.branches.development,
                            param.release.branch,
                            param.issueNumber,
                            undefined,
                            param.tokens.token,
                        )

                        const lastAction = linkResult[linkResult.length - 1];
                        const reminders = []

                        if (lastAction.success) {

                            const branchName = lastAction.payload.newBranchName;

                            let commitPrefix = ''
                            if (param.commitPrefixBuilder.length > 0) {
                                param.commitPrefixBuilderParams = {
                                    branchName: branchName,
                                }
                                const executor = new ExecuteScriptUseCase();
                                const prefixResult = await executor.invoke(param);
                                commitPrefix = prefixResult[prefixResult.length - 1].payload['scriptResult'].toString() ?? ''
                            }

                            reminders.push(`Before deploying, apply any change needed in [**${param.release.branch}**](${releaseUrl}):
> \`\`\`bash
> git fetch -v && git checkout ${param.release.branch}
> \`\`\`
>
> Version files, changelogs..`)
                                                
                            if (commitPrefix.length > 0) {
                                reminders.push(`Commit the needed changes with this prefix:
> \`\`\`
>${commitPrefix}
> \`\`\``)
                            }
                            reminders.push(...[
                                `Create the tag version in [**${param.release.branch}**](${releaseUrl}).
> Avoid using \`git merge --squash\`, otherwise the created tag will be lost.`,
                                `Add the **${param.labels.deploy}** label to run the \`${param.workflows.release}\` workflow.`,
                                `After deploying, the new changes on [\`${param.release.branch}\`](${releaseUrl}) must end on [\`${param.branches.development}\`](${developmentUrl}) and [\`${param.branches.main}\`](${mainUrl}).
> **Quick actions:**
> [New PR](https://github.com/${param.owner}/${param.repo}/compare/${param.branches.development}...${param.release.branch}?expand=1) from [\`${param.release.branch}\`](${releaseUrl}) to [\`${param.branches.development}\`](${developmentUrl}).
> [New PR](https://github.com/${param.owner}/${param.repo}/compare/${param.branches.main}...${param.release.branch}?expand=1) from [\`${param.release.branch}\`](${releaseUrl}) to [\`${param.branches.main}\`](${mainUrl}).`,
                            ])
                       
                            result.push(
                                new Result({
                                    id: this.taskId,
                                    success: true,
                                    executed: true,
                                    steps: [
                                        `The branch [**${param.branches.development}**](${developmentUrl}) was used to create the branch [**${param.release.branch}**](${releaseUrl})`,
                                    ],
                                    reminders: reminders,
                                })
                            )
                            logDebugInfo(`Release branch successfully linked to issue: ${JSON.stringify(linkResult)}`);
                        }
                    } else {
                        result.push(
                            new Result({
                                id: this.taskId,
                                success: true,
                                executed: true,
                                reminders: [
                                    `After deploying, the new changes on [\`${param.release.branch}\`](${releaseUrl}) must end on [\`${param.branches.development}\`](${developmentUrl}) and [\`${param.branches.main}\`](${mainUrl}).
> **Quick actions:**
> [New PR](https://github.com/${param.owner}/${param.repo}/compare/${param.branches.development}...${param.release.branch}?expand=1) from [\`${param.release.branch}\`](${releaseUrl}) to [\`${param.branches.development}\`](${developmentUrl}).
> [New PR](https://github.com/${param.owner}/${param.repo}/compare/${param.branches.main}...${param.release.branch}?expand=1) from [\`${param.release.branch}\`](${releaseUrl}) to [\`${param.branches.main}\`](${mainUrl}).`,
                                ],
                            })
                        )
                    }
                } else {
                    result.push(
                        new Result({
                            id: this.taskId,
                            success: false,
                            executed: true,
                            steps: [
                                `Tried to create a release but no release version was found.`,
                            ]
                        })
                    )
                }
                return result
            }
            
            logDebugInfo(`Branch type: ${param.managementBranch}`);

            const branchesResult = await this.branchRepository.manageBranches(
                param,
                param.owner,
                param.repo,
                param.issueNumber,
                issueTitle,
                param.managementBranch,
                param.branches.development,
                param.hotfix?.branch,
                param.hotfix.active,
                param.tokens.token,
            )

            result.push(
                ...branchesResult
            )

            const lastAction = branchesResult[branchesResult.length - 1];
            if (lastAction.success && lastAction.executed) {

                const branchName = lastAction.payload.newBranchName;

                param.currentConfiguration.workingBranch = branchName

                let commitPrefix = ''
                if (param.commitPrefixBuilder.length > 0) {
                    param.commitPrefixBuilderParams = {
                        branchName: branchName,
                    }
                    const executor = new ExecuteScriptUseCase();
                    const prefixResult = await executor.invoke(param);
                    commitPrefix = prefixResult[prefixResult.length - 1].payload['scriptResult'].toString() ?? ''
                }

                const rename = lastAction.payload.baseBranchName.indexOf(`${param.branches.featureTree}/`) > -1
                    || lastAction.payload.baseBranchName.indexOf(`${param.branches.bugfixTree}/`) > -1
                let step: string
                let reminder: string
                if (rename) {
                    const developmentUrl = `https://github.com/${param.owner}/${param.repo}/tree/${param.branches.development}`;
                    step = `The branch **${lastAction.payload.baseBranchName}** was renamed to [**${lastAction.payload.newBranchName}**](${lastAction.payload.newBranchUrl}).`
                    reminder = `Open a Pull Request from [\`${lastAction.payload.newBranchName}\`](${lastAction.payload.newBranchUrl}) to [\`${param.branches.development}\`](${developmentUrl}). [New PR](https://github.com/${param.owner}/${param.repo}/compare/${param.branches.development}...${lastAction.payload.newBranchName}?expand=1)`
                } else {
                    step = `The branch [**${lastAction.payload.baseBranchName}**](${lastAction.payload.baseBranchUrl}) was used to create [**${lastAction.payload.newBranchName}**](${lastAction.payload.newBranchUrl}).`
                    reminder = `Open a Pull Request from [\`${lastAction.payload.newBranchName}\`](${lastAction.payload.newBranchUrl}) to [\`${lastAction.payload.baseBranchName}\`](${lastAction.payload.baseBranchUrl}). [New PR](https://github.com/${param.owner}/${param.repo}/compare/${lastAction.payload.baseBranchName}...${lastAction.payload.newBranchName}?expand=1)`
                }

                const reminders = []
                reminders.push(`Check out the branch:
> \`\`\`bash
> git fetch -v && git checkout ${lastAction.payload.newBranchName}
> \`\`\``)
                
                if (commitPrefix.length > 0) {
                    reminders.push(`Commit the needed changes with this prefix:
> \`\`\`
>${commitPrefix}
> \`\`\``)
                }
                reminders.push(reminder)
                result.push(
                    new Result({
                        id: this.taskId,
                        success: true,
                        executed: true,
                        steps: [
                            step,
                        ],
                        reminders: reminders,
                    })
                )
                if (param.hotfix.active) {
                    const mainBranchUrl = `https://github.com/${param.owner}/${param.repo}/tree/${param.branches.main}`;
                    result.push(
                        new Result({
                            id: this.taskId,
                            success: true,
                            executed: true,
                            reminders: [
                                `After merging into [\`${lastAction.payload.baseBranchName}\`](${lastAction.payload.baseBranchUrl}), open a Pull Request from [\`${lastAction.payload.baseBranchName}\`](${lastAction.payload.baseBranchUrl}) to [\`${param.branches.main}\`](${mainBranchUrl}). [New PR](https://github.com/${param.owner}/${param.repo}/compare/${param.branches.main}...${lastAction.payload.baseBranchName}?expand=1)`,
                                `After merging into [\`${param.branches.main}\`](${mainBranchUrl}), create the tag \`${param.hotfix.version}\`.`,
                            ]
                        })
                    )
                }

                await new Promise(resolve => setTimeout(resolve, 10000));
                result.push(...await new MoveIssueToInProgressUseCase().invoke(param));
            }

            return result;
        } catch (error) {
            logError(error);
            result.push(
                new Result({
                    id: this.taskId,
                    success: false,
                    executed: true,
                    steps: [
                        `Tried to prepare the hotfix branch to the issue, but there was a problem.`,
                    ],
                    error: error,
                })
            )
        }
        return result;
    }
}