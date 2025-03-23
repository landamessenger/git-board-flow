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

    sizeXxl: string;
    sizeXl: string;
    sizeL: string;
    sizeM: string;
    sizeS: string;
    sizeXs: string;
    
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

    get isSizeXxl(): boolean {
        return this.currentIssueLabels.includes(this.sizeXxl);
    }

    get isSizeXl(): boolean {
        return this.currentIssueLabels.includes(this.sizeXl);
    }

    get isSizeL(): boolean {
        return this.currentIssueLabels.includes(this.sizeL);
    }

    get isSizeM(): boolean {
        return this.currentIssueLabels.includes(this.sizeM);
    }

    get isSizeS(): boolean {
        return this.currentIssueLabels.includes(this.sizeS);
    }

    get isSizeXs(): boolean {
        return this.currentIssueLabels.includes(this.sizeXs);
    }

    get sizedLabel(): string | undefined {
        if (this.currentIssueLabels.includes(this.sizeXxl)) {
            return this.sizeXxl;
        } else if (this.currentIssueLabels.includes(this.sizeXl)) {
            return this.sizeXl;
        } else if (this.currentIssueLabels.includes(this.sizeL)) {
            return this.sizeL;
        } else if (this.currentIssueLabels.includes(this.sizeM)) {
            return this.sizeM;
        } else if (this.currentIssueLabels.includes(this.sizeS)) {
            return this.sizeS;
        } else if (this.currentIssueLabels.includes(this.sizeXs)) {
            return this.sizeXs;
        }
        return undefined;
    }

    get isSized(): boolean {
        return this.sizedLabel !== undefined;
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
        sizeXxl: string,
        sizeXl: string,
        sizeL: string,
        sizeM: string,
        sizeS: string,
        sizeXs: string,
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
        this.sizeXxl = sizeXxl;
        this.sizeXl = sizeXl;
        this.sizeL = sizeL;
        this.sizeM = sizeM;
        this.sizeS = sizeS;
        this.sizeXs = sizeXs;
    }
}
