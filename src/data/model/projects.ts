import { ProjectDetail } from "./project_detail";

export class Projects {
    private projects: ProjectDetail[];
    private projectColumnIssueCreated: string;
    private projectColumnPullRequestCreated: string;
    private projectColumnIssueInProgress: string;
    private projectColumnPullRequestInProgress: string;

    constructor(
        projects: ProjectDetail[],
        projectColumnIssueCreated: string,
        projectColumnPullRequestCreated: string,
        projectColumnIssueInProgress: string,
        projectColumnPullRequestInProgress: string,
    ) {
        this.projects = projects;
        this.projectColumnIssueCreated = projectColumnIssueCreated;
        this.projectColumnPullRequestCreated = projectColumnPullRequestCreated;
        this.projectColumnIssueInProgress = projectColumnIssueInProgress;
        this.projectColumnPullRequestInProgress = projectColumnPullRequestInProgress;
    }

    getProjects(): ProjectDetail[] {
        return this.projects;
    }

    getProjectColumnIssueCreated(): string {
        return this.projectColumnIssueCreated;
    }

    getProjectColumnPullRequestCreated(): string {
        return this.projectColumnPullRequestCreated;
    }

    getProjectColumnIssueInProgress(): string {
        return this.projectColumnIssueInProgress;
    }

    getProjectColumnPullRequestInProgress(): string {
        return this.projectColumnPullRequestInProgress;
    }
}
