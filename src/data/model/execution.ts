import {ProjectDetail} from "./project_detail";
import {Tokens} from "./tokens";
import {Labels} from "./labels";
import {Branches} from "./branches";
import {Hotfix} from "./hotfix";
import {PullRequestRepository} from "../repository/pull_request_repository";
import {IssueRepository} from "../repository/issue_repository";
import * as github from "@actions/github";
import {branchesForIssue} from "../utils/label_utils";
import {Issue} from "./issue";
import {PullRequest} from "./pull_request";
import {extractIssueNumberFromBranch} from "../utils/title_utils";

export class Execution {
    runAlways: boolean;
    emojiLabeledTitle: boolean;
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

    get issue(): Issue {
        return new Issue();
    }

    get pullRequest(): PullRequest {
        return new PullRequest();
    }

    constructor(
        runAlways: boolean,
        emojiLabeledTitle: boolean,
        issueAction: boolean,
        pullRequestAction: boolean,
        tokens: Tokens,
        labels: Labels,
        branches: Branches,
        hotfix: Hotfix,
        projects: ProjectDetail[],
    ) {
        this.tokens = tokens;
        this.emojiLabeledTitle = emojiLabeledTitle;
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
            this.number = this.issue.number;
            const issueRepository = new IssueRepository();
            this.labels.currentLabels = await issueRepository.getLabels(
                this.owner,
                this.repo,
                this.number,
                this.tokens.token
            );
        } else if (this.pullRequestAction) {
            const pullRequestRepository = new PullRequestRepository();
            this.number = extractIssueNumberFromBranch(this.pullRequest.head);
            this.labels.currentLabels = await pullRequestRepository.getLabels(
                this.owner,
                this.repo,
                this.pullRequest.number,
                this.tokens.token
            );
        }
    }
}