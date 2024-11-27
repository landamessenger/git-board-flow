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
import {extractIssueNumberFromBranch, extractIssueNumberFromBranchB} from "../utils/title_utils";
import {Config} from "./config";
import {Images} from "./images";
import {Commit} from "./commit";

export class Execution {
    runAlways: boolean;
    emojiLabeledTitle: boolean;
    number: number = -1
    issueAction: boolean = false;
    commitAction: boolean = false;
    pullRequestAction: boolean = false;
    commitPrefixBuilder: string;
    giphy: Images;
    tokens: Tokens;
    labels: Labels;
    branches: Branches;
    hotfix: Hotfix;
    projects: ProjectDetail[];
    previousConfiguration: Config | undefined;
    currentConfiguration: Config;

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
        return this.commitAction || (this.runAlways || this.labels.runnerLabels);
    }

    get mustCleanAll(): boolean {
        return this.issueAction && !this.mustRun;
    }

    get branchType(): string {
        return branchesForIssue(
            this.labels.currentLabels,
            this.labels.bugfix,
            this.labels.hotfix,
        );
    }

    get cleanManagement(): boolean {
        console.log(`issueAction: ${this.issueAction}`)
        console.log(`previousConfiguration: ${JSON.stringify(this.previousConfiguration)}`)
        console.log(`previousConfiguration.branchType: ${this.previousConfiguration?.branchType}`)
        console.log(`currentConfiguration.branchType: ${this.currentConfiguration?.branchType}`)
        return this.issueAction
            && this.previousConfiguration !== undefined
            && this.previousConfiguration?.branchType != this.currentConfiguration.branchType;
    }

    get issue(): Issue {
        return new Issue();
    }

    get pullRequest(): PullRequest {
        return new PullRequest();
    }

    get commit(): Commit {
        return new Commit();
    }

    constructor(
        runAlways: boolean,
        emojiLabeledTitle: boolean,
        issueAction: boolean,
        pullRequestAction: boolean,
        commitAction: boolean,
        commitPrefixBuilder: string,
        giphy: Images,
        tokens: Tokens,
        labels: Labels,
        branches: Branches,
        hotfix: Hotfix,
        projects: ProjectDetail[],
    ) {
        this.commitPrefixBuilder = commitPrefixBuilder;
        this.giphy = giphy;
        this.tokens = tokens;
        this.emojiLabeledTitle = emojiLabeledTitle;
        this.labels = labels;
        this.branches = branches;
        this.hotfix = hotfix;
        this.runAlways = runAlways;
        this.issueAction = issueAction;
        this.pullRequestAction = pullRequestAction;
        this.commitAction = commitAction;
        this.projects = projects;
        this.currentConfiguration = new Config({});
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
            this.hotfix.active = await issueRepository.isHotfix(
                this.owner,
                this.repo,
                this.issue.number,
                this.labels.hotfix,
                this.tokens.token,
            );
            this.previousConfiguration = await issueRepository.readConfig(
                this.owner,
                this.repo,
                this.issue.number,
                this.tokens.token,
            )
            this.currentConfiguration.issueBranch = this.branchType
        } else if (this.pullRequestAction) {
            const pullRequestRepository = new PullRequestRepository();
            this.number = extractIssueNumberFromBranch(this.pullRequest.head);
            this.labels.currentLabels = await pullRequestRepository.getLabels(
                this.owner,
                this.repo,
                this.pullRequest.number,
                this.tokens.token
            );
            this.hotfix.active = this.pullRequest.base.indexOf(`${this.branches.hotfixTree}/`) > -1
            this.previousConfiguration = await pullRequestRepository.readConfig(
                this.owner,
                this.repo,
                this.issue.number,
                this.tokens.token,
            )
        } else if (this.commitAction) {
            this.number = extractIssueNumberFromBranchB(this.commit.branch)
            const pullRequestRepository = new PullRequestRepository();
            this.previousConfiguration = await pullRequestRepository.readConfig(
                this.owner,
                this.repo,
                this.number,
                this.tokens.token,
            )
        }
        this.currentConfiguration.branchType = this.branchType
    }
}