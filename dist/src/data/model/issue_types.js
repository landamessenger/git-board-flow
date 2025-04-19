"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IssueTypes = void 0;
class IssueTypes {
    constructor(task, bug, feature, documentation, maintenance, hotfix, release, question, help) {
        this.task = task;
        this.bug = bug;
        this.feature = feature;
        this.documentation = documentation;
        this.maintenance = maintenance;
        this.hotfix = hotfix;
        this.release = release;
        this.question = question;
        this.help = help;
    }
}
exports.IssueTypes = IssueTypes;
