export class Labels {
    branchManagementLauncherLabel: string;
    bug: string;
    bugfix: string;
    hotfix: string;
    enhancement: string;
    feature: string;
    release: string;
    question: string;
    help: string;
    currentLabels: string[] = [];

    get containsBranchedLabel(): boolean {
        return this.currentLabels.includes(this.branchManagementLauncherLabel);
    }

    get isHelp(): boolean {
        return this.currentLabels.includes(this.help);
    }

    get isQuestion(): boolean {
        return this.currentLabels.includes(this.question);
    }

    get isFeature(): boolean {
        return this.currentLabels.includes(this.feature);
    }

    get isEnhancement(): boolean {
        return this.currentLabels.includes(this.enhancement);
    }

    get isBugfix(): boolean {
        return this.currentLabels.includes(this.bugfix);
    }

    get isBug(): boolean {
        return this.currentLabels.includes(this.bug);
    }

    get isHotfix(): boolean {
        return this.currentLabels.includes(this.hotfix);
    }

    get isRelease(): boolean {
        return this.currentLabels.includes(this.release);
    }

    constructor(
        branchManagementLauncherLabel: string,
        bug: string,
        bugfix: string,
        hotfix: string,
        enhancement: string,
        feature: string,
        release: string,
        question: string,
        help: string,
    ) {
        this.branchManagementLauncherLabel = branchManagementLauncherLabel;
        this.bug = bug;
        this.bugfix = bugfix;
        this.hotfix = hotfix;
        this.enhancement = enhancement;
        this.feature = feature;
        this.release = release;
        this.question = question;
        this.help = help;
    }
}