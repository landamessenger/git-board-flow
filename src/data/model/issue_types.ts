
export class IssueTypes {
    task: string;
    taskDescription: string;
    taskColor: string;

    bug: string;
    bugDescription: string;
    bugColor: string;

    feature: string;
    featureDescription: string;
    featureColor: string;

    documentation: string;
    documentationDescription: string;
    documentationColor: string;

    maintenance: string;
    maintenanceDescription: string;
    maintenanceColor: string;

    hotfix: string;
    hotfixDescription: string;
    hotfixColor: string;

    release: string;
    releaseDescription: string;
    releaseColor: string;

    question: string;
    questionDescription: string;
    questionColor: string;

    help: string;
    helpDescription: string;
    helpColor: string;

    constructor(
        task: string,
        taskDescription: string,
        taskColor: string,
        bug: string,
        bugDescription: string,
        bugColor: string,
        feature: string,
        featureDescription: string,
        featureColor: string,
        documentation: string,
        documentationDescription: string,
        documentationColor: string,
        maintenance: string,
        maintenanceDescription: string,
        maintenanceColor: string,
        hotfix: string,
        hotfixDescription: string,
        hotfixColor: string,
        release: string,
        releaseDescription: string,
        releaseColor: string,
        question: string,
        questionDescription: string,
        questionColor: string,
        help: string,
        helpDescription: string,
        helpColor: string,
    ) {
        this.task = task;
        this.taskDescription = taskDescription;
        this.taskColor = taskColor;

        this.bug = bug;
        this.bugDescription = bugDescription;
        this.bugColor = bugColor;

        this.feature = feature;
        this.featureDescription = featureDescription;
        this.featureColor = featureColor;

        this.documentation = documentation;
        this.documentationDescription = documentationDescription;
        this.documentationColor = documentationColor;

        this.maintenance = maintenance;
        this.maintenanceDescription = maintenanceDescription;
        this.maintenanceColor = maintenanceColor;

        this.hotfix = hotfix;
        this.hotfixDescription = hotfixDescription;
        this.hotfixColor = hotfixColor;

        this.release = release;
        this.releaseDescription = releaseDescription;
        this.releaseColor = releaseColor;

        this.question = question;
        this.questionDescription = questionDescription;
        this.questionColor = questionColor;
        
        this.help = help;
        this.helpDescription = helpDescription;
        this.helpColor = helpColor;
    }
}