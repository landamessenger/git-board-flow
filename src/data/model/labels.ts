export class Labels {
    actionLauncher: string;
    bugfix: string;
    hotfix: string;
    feature: string;
    release: string;
    question: string;
    help: string;
    currentLabels: string[] = [];

    get runnerLabels(): boolean {
        return this.currentLabels.includes(this.actionLauncher);
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

    get isBugfix(): boolean {
        return this.currentLabels.includes(this.bugfix);
    }

    get isHotfix(): boolean {
        return this.currentLabels.includes(this.hotfix);
    }

    constructor(
        actionLauncher: string,
        bugfix: string,
        hotfix: string,
        feature: string,
        release: string,
        question: string,
        help: string,
    ) {
        this.actionLauncher = actionLauncher;
        this.bugfix = bugfix;
        this.hotfix = hotfix;
        this.feature = feature;
        this.release = release;
        this.question = question;
        this.help = help;
    }
}