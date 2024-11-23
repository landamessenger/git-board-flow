import {ProjectDetail} from "./project_detail";
import {Tokens} from "./tokens";
import {Labels} from "./labels";
import {Branches} from "./branches";
import {Hotfix} from "./hotfix";
import {PullRequestRepository} from "../repository/pull_request_repository";
import {IssueRepository} from "../repository/issue_repository";
import * as github from "@actions/github";
import {branchesForIssue} from "../utils/label_utils";

export class Execution {
    runAlways: boolean;
    number: number = -1
    issueAction: boolean = false;
    pullRequestAction: boolean = false;
    tokens: Tokens;
    labels: Labels;
    branches: Branches;
    hotfix: Hotfix;
    projects: ProjectDetail[];

    get repo(): string {
        return github.context.repo.repo;
    }

    get owner(): string {
        return github.context.repo.owner;
    }

    get isFeature(): boolean {
        return this.branchType === 'feature';
    }

    get isBugfix(): boolean {
        return this.branchType === 'bugfix';
    }

    get mustRun(): boolean {
        return this.runAlways || this.labels.runnerLabels;
    }

    get branchType(): string {
        return branchesForIssue(
            this.labels.currentLabels,
            this.labels.bugfix,
            this.labels.hotfix,
        );
    }

    constructor(
        runAlways: boolean,
        issueAction: boolean,
        pullRequestAction: boolean,
        tokens: Tokens,
        labels: Labels,
        branches: Branches,
        hotfix: Hotfix,
        projects: ProjectDetail[],
    ) {
        this.tokens = tokens;
        this.labels = labels;
        this.branches = branches;
        this.hotfix = hotfix;
        this.runAlways = runAlways;
        this.issueAction = issueAction;
        this.pullRequestAction = pullRequestAction;
        this.projects = projects;
    }

    setup = async () => {
        if (this.issueAction) {
            this.number = github.context.payload.issue?.number ?? -1;
            const issueRepository = new IssueRepository();
            this.labels.currentLabels = await issueRepository.getIssueLabels(this.tokens.token);
        } else if (this.pullRequestAction) {
            const pullRequestRepository = new PullRequestRepository();
            this.number = await pullRequestRepository.extractIssueNumberFromBranch();
            this.labels.currentLabels = await pullRequestRepository.getLabels(this.tokens.token);
        }
    }
}