"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Labels = void 0;
class Labels {
    get isMandatoryBranchedLabel() {
        return this.isHotfix || this.isRelease;
    }
    get containsBranchedLabel() {
        return this.currentIssueLabels.includes(this.branchManagementLauncherLabel);
    }
    get isDeploy() {
        return this.currentIssueLabels.includes(this.deploy);
    }
    get isDeployed() {
        return this.currentIssueLabels.includes(this.deployed);
    }
    get isHelp() {
        return this.currentIssueLabels.includes(this.help);
    }
    get isQuestion() {
        return this.currentIssueLabels.includes(this.question);
    }
    get isFeature() {
        return this.currentIssueLabels.includes(this.feature);
    }
    get isEnhancement() {
        return this.currentIssueLabels.includes(this.enhancement);
    }
    get isBugfix() {
        return this.currentIssueLabels.includes(this.bugfix);
    }
    get isBug() {
        return this.currentIssueLabels.includes(this.bug);
    }
    get isHotfix() {
        return this.currentIssueLabels.includes(this.hotfix);
    }
    get isRelease() {
        return this.currentIssueLabels.includes(this.release);
    }
    get isDocs() {
        return this.currentIssueLabels.includes(this.docs);
    }
    get isDocumentation() {
        return this.currentIssueLabels.includes(this.documentation);
    }
    get isChore() {
        return this.currentIssueLabels.includes(this.chore);
    }
    get isMaintenance() {
        return this.currentIssueLabels.includes(this.maintenance);
    }
    get sizeLabels() {
        return [this.sizeXxl, this.sizeXl, this.sizeL, this.sizeM, this.sizeS, this.sizeXs];
    }
    get sizedLabelOnIssue() {
        if (this.currentIssueLabels.includes(this.sizeXxl)) {
            return this.sizeXxl;
        }
        else if (this.currentIssueLabels.includes(this.sizeXl)) {
            return this.sizeXl;
        }
        else if (this.currentIssueLabels.includes(this.sizeL)) {
            return this.sizeL;
        }
        else if (this.currentIssueLabels.includes(this.sizeM)) {
            return this.sizeM;
        }
        else if (this.currentIssueLabels.includes(this.sizeS)) {
            return this.sizeS;
        }
        else if (this.currentIssueLabels.includes(this.sizeXs)) {
            return this.sizeXs;
        }
        return undefined;
    }
    get sizedLabelOnPullRequest() {
        if (this.currentPullRequestLabels.includes(this.sizeXxl)) {
            return this.sizeXxl;
        }
        else if (this.currentPullRequestLabels.includes(this.sizeXl)) {
            return this.sizeXl;
        }
        else if (this.currentPullRequestLabels.includes(this.sizeL)) {
            return this.sizeL;
        }
        else if (this.currentPullRequestLabels.includes(this.sizeM)) {
            return this.sizeM;
        }
        else if (this.currentPullRequestLabels.includes(this.sizeS)) {
            return this.sizeS;
        }
        else if (this.currentPullRequestLabels.includes(this.sizeXs)) {
            return this.sizeXs;
        }
        return undefined;
    }
    get isIssueSized() {
        return this.sizedLabelOnIssue !== undefined;
    }
    get isPullRequestSized() {
        return this.sizedLabelOnPullRequest !== undefined;
    }
    get priorityLabels() {
        return [this.priorityHigh, this.priorityMedium, this.priorityLow, this.priorityNone];
    }
    get priorityLabelOnIssue() {
        if (this.currentIssueLabels.includes(this.priorityHigh)) {
            return this.priorityHigh;
        }
        else if (this.currentIssueLabels.includes(this.priorityMedium)) {
            return this.priorityMedium;
        }
        else if (this.currentIssueLabels.includes(this.priorityLow)) {
            return this.priorityLow;
        }
        else if (this.currentIssueLabels.includes(this.priorityNone)) {
            return this.priorityNone;
        }
        return undefined;
    }
    get priorityLabelOnIssueProcessable() {
        return this.currentIssueLabels.includes(this.priorityHigh) ||
            this.currentIssueLabels.includes(this.priorityMedium) ||
            this.currentIssueLabels.includes(this.priorityLow);
    }
    get priorityLabelOnPullRequest() {
        if (this.currentPullRequestLabels.includes(this.priorityHigh)) {
            return this.priorityHigh;
        }
        else if (this.currentPullRequestLabels.includes(this.priorityMedium)) {
            return this.priorityMedium;
        }
        else if (this.currentPullRequestLabels.includes(this.priorityLow)) {
            return this.priorityLow;
        }
        else if (this.currentPullRequestLabels.includes(this.priorityNone)) {
            return this.priorityNone;
        }
        return undefined;
    }
    get priorityLabelOnPullRequestProcessable() {
        return this.currentPullRequestLabels.includes(this.priorityHigh) ||
            this.currentPullRequestLabels.includes(this.priorityMedium) ||
            this.currentPullRequestLabels.includes(this.priorityLow);
    }
    get isIssuePrioritized() {
        return this.priorityLabelOnIssue !== undefined && this.priorityLabelOnIssue !== this.priorityNone;
    }
    get isPullRequestPrioritized() {
        return this.priorityLabelOnPullRequest !== undefined && this.priorityLabelOnPullRequest !== this.priorityNone;
    }
    constructor(branchManagementLauncherLabel, bug, bugfix, hotfix, enhancement, feature, release, question, help, deploy, deployed, docs, documentation, chore, maintenance, priorityHigh, priorityMedium, priorityLow, priorityNone, sizeXxl, sizeXl, sizeL, sizeM, sizeS, sizeXs) {
        this.currentIssueLabels = [];
        this.currentPullRequestLabels = [];
        this.branchManagementLauncherLabel = branchManagementLauncherLabel;
        this.bug = bug;
        this.bugfix = bugfix;
        this.hotfix = hotfix;
        this.enhancement = enhancement;
        this.feature = feature;
        this.release = release;
        this.question = question;
        this.help = help;
        this.deploy = deploy;
        this.deployed = deployed;
        this.docs = docs;
        this.documentation = documentation;
        this.chore = chore;
        this.maintenance = maintenance;
        this.sizeXxl = sizeXxl;
        this.sizeXl = sizeXl;
        this.sizeL = sizeL;
        this.sizeM = sizeM;
        this.sizeS = sizeS;
        this.sizeXs = sizeXs;
        this.priorityHigh = priorityHigh;
        this.priorityMedium = priorityMedium;
        this.priorityLow = priorityLow;
        this.priorityNone = priorityNone;
    }
}
exports.Labels = Labels;
