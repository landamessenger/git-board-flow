import {BranchConfiguration} from "./branch_configuration";

export class Config {
    branchConfiguration: BranchConfiguration | undefined;

    constructor(data: any) {
        if (data['branchConfiguration'] !== undefined) {
            this.branchConfiguration = new BranchConfiguration(data['branchConfiguration']);
        }
    }
}