import {BranchConfiguration} from "./branch_configuration";
import {Result} from "./result";

export class Config {
    branchType: string;
    hotfixBranch: string | undefined;
    results: Result[] = [];
    branchConfiguration: BranchConfiguration | undefined;

    constructor(data: any) {
        this.branchType = data['branchType'] ?? '';
        this.hotfixBranch = data['hotfixBranch'];
        if (data['branchConfiguration'] !== undefined) {
            this.branchConfiguration = new BranchConfiguration(data['branchConfiguration']);
        }
    }
}