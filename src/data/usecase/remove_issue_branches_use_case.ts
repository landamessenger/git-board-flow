import {IssueRepository} from "../repository/issue_repository";
import {BranchRepository} from "../repository/branch_repository";
import {ParamUseCase} from "./base/param_usecase";
import {Execution} from "../model/execution";

/**
 * Remove any branch created for this issue
 */
export class RemoveIssueBranchesUseCase implements ParamUseCase<Execution, void> {
    private issueRepository = new IssueRepository();
    private branchRepository = new BranchRepository();

    async invoke(param: Execution): Promise<void> {
        const deletedBranches = []

        const branchTypes = ["feature", "bugfix"];

        const branches = await this.branchRepository.getListOfBranches(param.tokens.token);

        for (const type of branchTypes) {
            let branchName = '';
            const prefix = `${type}/${param.number}-`;

            const matchingBranch = branches.find(branch => branch.indexOf(prefix) > -1);
            if (!matchingBranch) continue;
            branchName = matchingBranch;
            const removed = await this.branchRepository.removeBranch(param.tokens.token, branchName);
            if (removed) {
                deletedBranches.push(branchName);
            }
        }

        let deletedBranchesMessage = ''
        for (let i = 0; i < deletedBranches.length; i++) {
            const branch = deletedBranches[i];
            deletedBranchesMessage += `\n${i + 1}. The branch \`${branch}\` was removed.`
        }

        const commentBody = `## 🗑️ Cleanup Actions:
${deletedBranchesMessage}
`;

        await this.issueRepository.addComment(param.tokens.token, commentBody);
    }
}