import { BranchConfiguration } from "./branch_configuration";
import { Result } from "./result";
export declare class Config {
    branchType: string;
    releaseBranch: string | undefined;
    parentBranch: string | undefined;
    hotfixOriginBranch: string | undefined;
    hotfixBranch: string | undefined;
    results: Result[];
    branchConfiguration: BranchConfiguration | undefined;
    constructor(data: any);
}
