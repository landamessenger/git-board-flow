
export class IssueTypes {
    task: string;
    bug: string;
    feature: string;
    documentation: string;
    maintenance: string;
    hotfix: string;
    release: string;
    question: string;
    help: string;

    constructor(
        task: string,
        bug: string,
        feature: string,
        documentation: string,
        maintenance: string,
        hotfix: string,
        release: string,
        question: string,
        help: string,
    ) {
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