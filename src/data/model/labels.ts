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
    deploy: string;
    deployed: string;
    docs: string;
    documentation: string;
    chore: string;
    maintenance: string;
    currentIssueLabels: string[] = [];
    currentPullRequestLabels: string[] = [];

    get isMandatoryBranchedLabel(): boolean {
        return this.isHotfix || this.isRelease;
    }

    get containsBranchedLabel(): boolean {
        return this.currentIssueLabels.includes(this.branchManagementLauncherLabel);
    }

    get isDeploy(): boolean {
        return this.currentIssueLabels.includes(this.deploy);
    }

    get isDeployed(): boolean {
        return this.currentIssueLabels.includes(this.deployed);
    }

    get isHelp(): boolean {
        return this.currentIssueLabels.includes(this.help);
    }

    get isQuestion(): boolean {
        return this.currentIssueLabels.includes(this.question);
    }

    get isFeature(): boolean {
        return this.currentIssueLabels.includes(this.feature);
    }

    get isEnhancement(): boolean {
        return this.currentIssueLabels.includes(this.enhancement);
    }

    get isBugfix(): boolean {
        return this.currentIssueLabels.includes(this.bugfix);
    }

    get isBug(): boolean {
        return this.currentIssueLabels.includes(this.bug);
    }

    get isHotfix(): boolean {
        return this.currentIssueLabels.includes(this.hotfix);
    }

    get isRelease(): boolean {
        return this.currentIssueLabels.includes(this.release);
    }

    get isDocs(): boolean {
        return this.currentIssueLabels.includes(this.docs);
    }

    get isDocumentation(): boolean {
        return this.currentIssueLabels.includes(this.documentation);
    }

    get isChore(): boolean {
        return this.currentIssueLabels.includes(this.chore);
    }

    get isMaintenance(): boolean {
        return this.currentIssueLabels.includes(this.maintenance);
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
        deploy: string,
        deployed: string,
        docs: string,
        documentation: string,
        chore: string,
        maintenance: string,
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
        this.deploy = deploy;
        this.deployed = deployed;
        this.docs = docs;
        this.documentation = documentation;
        this.chore = chore;
        this.maintenance = maintenance;
    }
}
