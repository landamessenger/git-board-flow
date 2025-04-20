"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Projects = void 0;
class Projects {
    constructor(projects, projectColumnIssueCreated, projectColumnPullRequestCreated, projectColumnIssueInProgress, projectColumnPullRequestInProgress) {
        this.projects = projects;
        this.projectColumnIssueCreated = projectColumnIssueCreated;
        this.projectColumnPullRequestCreated = projectColumnPullRequestCreated;
        this.projectColumnIssueInProgress = projectColumnIssueInProgress;
        this.projectColumnPullRequestInProgress = projectColumnPullRequestInProgress;
    }
    getProjects() {
        return this.projects;
    }
    getProjectColumnIssueCreated() {
        return this.projectColumnIssueCreated;
    }
    getProjectColumnPullRequestCreated() {
        return this.projectColumnPullRequestCreated;
    }
    getProjectColumnIssueInProgress() {
        return this.projectColumnIssueInProgress;
    }
    getProjectColumnPullRequestInProgress() {
        return this.projectColumnPullRequestInProgress;
    }
}
exports.Projects = Projects;
