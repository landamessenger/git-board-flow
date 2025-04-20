"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Config = void 0;
const branch_configuration_1 = require("./branch_configuration");
class Config {
    constructor(data) {
        this.results = [];
        this.branchType = data['branchType'] ?? '';
        this.hotfixOriginBranch = data['hotfixOriginBranch'];
        this.hotfixBranch = data['hotfixBranch'];
        this.releaseBranch = data['releaseBranch'];
        this.parentBranch = data['parentBranch'];
        this.workingBranch = data['workingBranch'];
        if (data['branchConfiguration'] !== undefined) {
            this.branchConfiguration = new branch_configuration_1.BranchConfiguration(data['branchConfiguration']);
        }
    }
}
exports.Config = Config;
