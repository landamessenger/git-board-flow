export class Labels {
    actionLauncher: string;
    bugfix: string;
    hotfix: string;
    currentLabels: string[] = [];

    get runnerLabels(): boolean {
        return this.currentLabels.includes(this.actionLauncher);
    }

    constructor(
        actionLauncher: string,
        bugfix: string,
        hotfix: string,
    ) {
        this.actionLauncher = actionLauncher;
        this.bugfix = bugfix;
        this.hotfix = hotfix;
    }
}