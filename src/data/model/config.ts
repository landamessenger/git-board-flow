import {BranchConfiguration} from "./branch_configuration";
import {Result} from "./result";

export class Config {
    branchType: string;
    releaseBranch: string | undefined;
    hotfixOriginBranch: string | undefined;
    hotfixBranch: string | undefined;
    results: Result[] = [];
    branchConfiguration: BranchConfiguration | undefined;

    constructor(data: any) {
        this.branchType = data['branchType'] ?? '';
        this.hotfixOriginBranch = data['hotfixOriginBranch'];
        this.hotfixBranch = data['hotfixBranch'];
        this.releaseBranch = data['releaseBranch'];
        if (data['branchConfiguration'] !== undefined) {
            this.branchConfiguration = new BranchConfiguration(data['branchConfiguration']);
        }
    }
}