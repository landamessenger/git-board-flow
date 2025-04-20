"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BranchConfiguration = void 0;
class BranchConfiguration {
    constructor(data) {
        this.name = data['name'] ?? '';
        this.oid = data['oid'] ?? '';
        this.children = [];
        if (data['children'] !== undefined && data['children'].length > 0) {
            for (let child of data['children']) {
                this.children.push(new BranchConfiguration(child));
            }
        }
    }
}
exports.BranchConfiguration = BranchConfiguration;
