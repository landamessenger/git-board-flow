import * as core from "@actions/core";
import {ParamUseCase} from "../base/param_usecase";
import {Execution} from "../../model/execution";
import {IssueRepository} from "../../repository/issue_repository";
import {BranchRepository} from "../../repository/branch_repository";
import {Result} from "../../model/result";

export class PrepareBranchesUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'PrepareBranchesUseCase';
    private issueRepository = new IssueRepository();
    private branchRepository = new BranchRepository();

    async invoke(param: Execution): Promise<Result[]> {
        const result: Result[] = []
        try {
            const issueTitle: string = param.issue.title;
            if (issueTitle.length === 0) {
                core.setFailed('Issue title not available.');
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
                        `Make yourself a coffee ☕.`
                    ]
                })
            )

            const lastTag = await this.branchRepository.getLatestTag();
            if (param.hotfix.active && lastTag !== undefined) {
                const branchOid = await this.branchRepository.getCommitTag(lastTag)
                const incrementHotfixVersion = (version: string) => {
                    const parts = version.split('.').map(Number);
                    parts[parts.length - 1] += 1;
                    return parts.join('.');
                };

                param.hotfix.version = incrementHotfixVersion(lastTag);

                const baseBranchName = `tags/${lastTag}`;
                param.hotfix.branch = `hotfix/${param.hotfix.version}`;

                core.info(`Tag branch: ${baseBranchName}`);
                core.info(`Hotfix branch: ${param.hotfix.branch}`);

                const linkResult = await this.branchRepository.createLinkedBranch(
                    param.owner,
                    param.repo,
                    baseBranchName,
                    param.hotfix.branch,
                    param.number,
                    branchOid,
                    param.tokens.tokenPat,
                )

                if (linkResult[linkResult.length - 1].success) {
                    const tagBranch = `tags/${lastTag}`;
                    const tagUrl = `https://github.com/${param.owner}/${param.repo}/tree/${tagBranch}`;
                    const hotfixUrl = `https://github.com/${param.owner}/${param.repo}/tree/${param.hotfix.branch}`;

                    result.push(
                        new Result({
                            id: this.taskId,
                            success: true,
                            executed: true,
                            steps: [
                                `The tag [\`${tagBranch}\`](${tagUrl}) was used to create the branch [\`${param.hotfix.branch}\`](${hotfixUrl})`,
                            ],
                        })
                    )
                    core.info(`Hotfix branch successfully linked to issue: ${JSON.stringify(linkResult)}`);
                }
            } else if (param.hotfix.active && lastTag === undefined) {
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

            core.info(`Branch type: ${param.branchType}`);

            const branchesResult = await this.branchRepository.manageBranches(
                param.owner,
                param.repo,
                param.number,
                issueTitle,
                param.branchType,
                param.branches.development,
                param.hotfix?.branch,
                param.hotfix.active,
                param.tokens.tokenPat,
            )

            result.push(
                ...branchesResult
            )

            const lastAction = branchesResult[branchesResult.length - 1];
            if (lastAction.success) {
                result.push(
                    new Result({
                        id: this.taskId,
                        success: true,
                        executed: true,
                        steps: [
                            `The branch [\`${lastAction.payload.baseBranchName}\`](${lastAction.payload.baseBranchUrl}) was used to create the branch [\`${lastAction.payload.newBranchName}\`](${lastAction.payload.newBranchUrl})`,
                        ],
                        reminders: [
                            `Commit the necessary changes to [\`${lastAction.payload.newBranchName}\`](${lastAction.payload.newBranchUrl}).`,
                            `Open a Pull Request from [\`${lastAction.payload.newBranchName}\`](${lastAction.payload.newBranchUrl}) to [\`${lastAction.payload.baseBranchName}\`](${lastAction.payload.baseBranchUrl}). [New PR](https://github.com/${param.owner}/${param.repo}/compare/${lastAction.payload.baseBranchName}...${lastAction.payload.newBranchName}?expand=1)`,
                        ]
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
                                `Open a Pull Request from [\`${lastAction.payload.baseBranchName}\`](${lastAction.payload.baseBranchUrl}) to [\`${param.branches.main}\`](${mainBranchUrl}) after merging into [\`${lastAction.payload.baseBranchName}\`](${lastAction.payload.baseBranchUrl}). [New PR](https://github.com/${param.owner}/${param.repo}/compare/${param.branches.main}...${lastAction.payload.baseBranchName}?expand=1)`,
                                `Create the tag \`tags/${param.hotfix.version}\` after merging into [\`${param.branches.main}\`](${mainBranchUrl})`,
                            ]
                        })
                    )
                }
            }

            return result;
        } catch (error) {
            console.error(error);
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